import { useEffect, useRef } from 'react';

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<any>(null); // use any or WakeLockSentinel if typed

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled) {
          lock.release();
          return;
        }
        wakeLockRef.current = lock;
      } catch (err) {
        console.warn('WakeLock failed:', err);
      }
    };

    requestWakeLock();

    // Re-acquire lock when screen visibility changes (e.g. user toggled screen/app back)
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible' && enabled && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.warn('WakeLock visibility restore failed:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().then(() => {
          wakeLockRef.current = null;
        }).catch(() => {});
      }
    };
  }, [enabled]);
}
