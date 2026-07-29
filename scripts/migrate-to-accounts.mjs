// One-time migration: name-keyed profiles (players/<name>) → uid-keyed accounts
// (accounts/<uid>). Additive & idempotent — it never deletes the old players
// docs, so rollback is just "point the app back at players/". Run with:
//   node scripts/migrate-to-accounts.mjs
//
// Each players/<name> doc already carries a stable `uid` (from an earlier
// backfill). We copy it to accounts/<uid>. If two name-docs somehow share a uid,
// the VERIFIED one (or the most recently created) wins.
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import fs from 'fs';

const env = {};
for (const line of fs.readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

const profs = await getDocs(collection(db, 'players'));
console.log(`Read ${profs.size} name-keyed profiles.`);

// Collapse to one account per uid; prefer verified, then newest.
const byUid = new Map();
let missingUid = 0;
for (const d of profs.docs) {
  const p = d.data();
  if (!p.uid) { missingUid++; continue; }
  const cur = byUid.get(p.uid);
  const better = !cur ||
    (!!p.phoneVerified && !cur.phoneVerified) ||
    ((p.phoneVerified === !!cur.phoneVerified) && (p.createdAt || 0) > (cur.createdAt || 0));
  if (better) {
    byUid.set(p.uid, {
      uid: p.uid,
      name: p.name || d.id,
      phone: p.phone ?? null,
      phoneVerified: !!p.phoneVerified,
      phoneVerifiedAt: p.phoneVerifiedAt ?? null,
      isAdmin: !!p.isAdmin,
      suspendedUntil: p.suspendedUntil ?? null,
      suspensionType: p.suspensionType ?? null,
      createdAt: p.createdAt ?? Date.now(),
      migratedFrom: d.id,
    });
  } else if (p.isAdmin && !cur.isAdmin) {
    // don't lose an admin flag when merging same-uid docs
    cur.isAdmin = true;
  }
}
if (missingUid) console.log(`  (${missingUid} profiles had no uid — skipped; shouldn't happen after backfill)`);

// Write accounts in batches, skipping ones that already exist unchanged.
const existing = new Set((await getDocs(collection(db, 'accounts'))).docs.map((d) => d.id));
let written = 0, skipped = 0, batch = writeBatch(db), ops = 0;
for (const [uid, acct] of byUid) {
  if (existing.has(uid)) { skipped++; continue; }
  batch.set(doc(db, 'accounts', uid), acct);
  ops++; written++;
  if (ops >= 400) { await batch.commit(); batch = writeBatch(db); ops = 0; }
}
if (ops > 0) await batch.commit();

console.log(`\nAccounts: wrote ${written}, skipped ${skipped} (already existed). Total unique people: ${byUid.size}.`);
process.exit(0);
