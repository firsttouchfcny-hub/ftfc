// Web-push helpers. Key iOS fact: Safari only delivers push to a PWA that has
// been added to the Home Screen and opened from that icon — never in a plain tab.

// VAPID public key — safe to ship in the client. The matching private key lives
// only on the server (Firebase Function secret) and signs the actual sends.
export const VAPID_PUBLIC_KEY =
  'BGC0LXE1jNTVZKJUldJ8haxUT2-UIWEgonFfBvoaWq2mOsr5K36N5Uf94f_RTAImdBkOcnmXiGNwraDwUVhr2dg';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Subscribe this device to web push (reusing an existing subscription if present).
export async function subscribeToPush(registration) {
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

export function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  );
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as Mac; detect by touch.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// True when running as an installed home-screen app (standalone display mode).
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('[FTFC] service worker registration failed:', err);
    return null;
  }
}

// Ask permission and fire a local test banner so the user sees it work end-to-end.
// Returns { ok, reason } — reason drives the guidance message in the UI.
export async function enableNotifications() {
  // Check the iPhone case FIRST: iOS Safari tabs don't expose Notification /
  // PushManager at all, so pushSupported() is false there — but the real fix is
  // "add to home screen," not "unsupported."
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-not-installed' };
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, reason: 'no-sw' };

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  await reg.showNotification('First Touch FC ⚽', {
    body: "Notifications are on — you'll get game and gear reminders right here.",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  });
  return { ok: true };
}
