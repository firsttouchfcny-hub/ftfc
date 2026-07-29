// Identity access — the person's canonical account is keyed by their stable uid
// at accounts/<uid>. Name and phone are just fields on it, so a person can rename
// or change their number without ever forking or losing their account.
import { db } from '../firebase/config';
import { doc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { normalizeName, newUid } from './helpers';

// The account document for a stable uid.
export function accountRef(uid) {
  return doc(db, 'accounts', uid);
}

// Resolve a typed name to an account (admin tools work by name). Matches on the
// normalized name, preferring a verified account. Returns { uid, ...data } | null.
export async function findAccountByName(name) {
  const key = normalizeName(name);
  const snap = await getDocs(collection(db, 'accounts'));
  const matches = snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((a) => normalizeName(a.name || '') === key);
  return matches.find((a) => a.phoneVerified) || matches[0] || null;
}

// Find the account for a name, or create a fresh one (admin adds / vouches for
// someone who hasn't signed up yet). Returns { uid, ...data }.
export async function ensureAccount(name, extra = {}) {
  const found = await findAccountByName(name);
  if (found) return found;
  const uid = newUid();
  const acct = {
    uid, name, phone: null, phoneVerified: false,
    isAdmin: false, suspendedUntil: null, suspensionType: null,
    createdAt: Date.now(), ...extra,
  };
  await setDoc(accountRef(uid), acct);
  return { ...acct };
}

// Find the account that owns a verified phone (E.164). Returns { uid, ...data }
// or null. Used at sign-in/verify to resolve a device to its one true account.
export async function findAccountByPhone(e164) {
  const snap = await getDocs(query(collection(db, 'accounts'), where('phone', '==', e164)));
  const hit = snap.docs.find((d) => d.data()?.phoneVerified);
  return hit ? { uid: hit.id, ...hit.data() } : null;
}

// Whether a phone already belongs to a DIFFERENT account (guards against one
// number being claimed by two accounts).
export async function phoneOwnedByOther(e164, myUid) {
  const snap = await getDocs(query(collection(db, 'accounts'), where('phone', '==', e164)));
  const hit = snap.docs.find((d) => d.id !== myUid && d.data()?.phoneVerified);
  return hit ? { uid: hit.id, ...hit.data() } : null;
}
