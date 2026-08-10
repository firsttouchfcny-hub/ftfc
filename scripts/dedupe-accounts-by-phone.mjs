// One phone = one account. Merges duplicate VERIFIED accounts that share a phone
// into a single canonical account (the most-referenced one), re-points every
// roster entry + gear commitment to it, preserves an admin flag, then deletes the
// duplicates. Run: node scripts/dedupe-accounts-by-phone.mjs
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import fs from 'fs';

const env = {};
for (const l of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID });
const db = getFirestore(app);

// Load accounts, all session players, and the gear ledger up front.
const accounts = (await getDocs(collection(db, 'accounts'))).docs.map((d) => ({ uid: d.id, ...d.data() }));
const sessions = [];
for (const s of (await getDocs(collection(db, 'sessions'))).docs) {
  sessions.push({ id: s.id, players: (await getDocs(collection(db, 'sessions', s.id, 'players'))).docs });
}
const ledRef = doc(db, 'gear', 'ledger');
let commitments = (((await getDoc(ledRef)).data() || {}).commitments) || [];

// Reference count per uid (how "used" each account is).
const refs = {};
for (const s of sessions) for (const p of s.players) { const u = p.data().uid; if (u) refs[u] = (refs[u] || 0) + 1; }
for (const c of commitments) if (c.takerUid) refs[c.takerUid] = (refs[c.takerUid] || 0) + 1;

// Group verified accounts by phone.
const byPhone = new Map();
for (const a of accounts) {
  if (!a.phoneVerified || !a.phone) continue;
  if (!byPhone.has(a.phone)) byPhone.set(a.phone, []);
  byPhone.get(a.phone).push(a);
}

let mergedAccounts = 0, gearChanged = false;
for (const [phone, group] of byPhone) {
  if (group.length < 2) continue;
  group.sort((a, b) => (refs[b.uid] || 0) - (refs[a.uid] || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  const canon = group[0];
  const losers = group.slice(1);
  const loserUids = new Set(losers.map((l) => l.uid));
  console.log(`${phone}: keep "${canon.name}" (${refs[canon.uid] || 0} refs); merge ${losers.map((l) => `"${l.name}"(${refs[l.uid] || 0})`).join(', ')}`);

  if (!canon.isAdmin && losers.some((l) => l.isAdmin)) {
    await setDoc(doc(db, 'accounts', canon.uid), { isAdmin: true }, { merge: true });
  }
  // Re-point roster entries → canonical (uid + name).
  for (const s of sessions) for (const p of s.players) {
    if (loserUids.has(p.data().uid)) await updateDoc(p.ref, { uid: canon.uid, name: canon.name });
  }
  // Re-point gear commitments.
  commitments = commitments.map((c) => {
    if (loserUids.has(c.takerUid)) { gearChanged = true; return { ...c, takerUid: canon.uid, takerName: canon.name }; }
    return c;
  });
  for (const l of losers) { await deleteDoc(doc(db, 'accounts', l.uid)); mergedAccounts++; }
}
if (gearChanged) await updateDoc(ledRef, { commitments });

console.log(`\nDone. Merged ${mergedAccounts} duplicate account(s). Accounts remaining verified-unique per phone.`);
process.exit(0);
