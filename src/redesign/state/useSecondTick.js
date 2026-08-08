// Re-render the caller every second so time-derived UI (the countdown, and the
// waiting→open transition at 3pm) stays live without a refresh. Also ticks when
// the tab regains focus/visibility, since mobile browsers pause timers in the
// background (same approach as the current app's App.jsx clock).

import { useEffect, useState } from 'react';

export function useSecondTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const id = setInterval(bump, 1000);
    const onWake = () => { if (!document.hidden) bump(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);
}
