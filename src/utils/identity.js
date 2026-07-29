// Identity access — the person's canonical account is keyed by their stable uid
// at accounts/<uid>. Name and phone are just fields on it, so a person can rename
// or change their number without ever forking or losing their account.
import { db } from '../firebase/config';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';

// The account document for a stable uid.
export function accountRef(uid) {
  return doc(db, 'accounts', uid);
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
