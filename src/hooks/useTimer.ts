import { useState, useEffect, useRef } from 'react';

export type TimerMode = 'stopwatch' | 'countdown';
export type TimerState = 'idle' | 'running' | 'paused' | 'finished';

interface UseTimerOptions {
  mode: TimerMode;
  initialSeconds?: number;     // Used for countdown
  onFinish?: () => void;       // Callback when countdown hits 0
}

export function useTimer({ mode, initialSeconds = 0, onFinish }: UseTimerOptions) {
  const [seconds, setSeconds] = useState(mode === 'countdown' ? initialSeconds : 0);
  const [state, setState] = useState<TimerState>('idle');

  const startedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0);
  const initialSecondsRef = useRef<number>(initialSeconds);
  const intervalRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);

  // Keep references fresh
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    initialSecondsRef.current = initialSeconds;
    if (state === 'idle') {
      setSeconds(mode === 'countdown' ? initialSeconds : 0);
    }
  }, [initialSeconds, mode, state]);

  // Tick calculator using Date.now()
  const tick = () => {
    if (state !== 'running' || !startedAtRef.current) return;
    const now = Date.now();
    const elapsedMs = now - startedAtRef.current + accumulatedMsRef.current;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    if (mode === 'stopwatch') {
      setSeconds(elapsedSeconds);
    } else {
      const remaining = Math.max(0, initialSecondsRef.current - elapsedSeconds);
      setSeconds(remaining);
      if (remaining === 0) {
        setState('finished');
        if (intervalRef.current) clearInterval(intervalRef.current);
        onFinishRef.current?.();
      }
    }
  };

  // Re-run tick calculation when running state changes
  useEffect(() => {
    if (state === 'running') {
      startedAtRef.current = Date.now();
      intervalRef.current = window.setInterval(tick, 200); // 200ms tick for responsive UI
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state]);

  const start = () => {
    if (state === 'idle' || state === 'finished') {
      startedAtRef.current = Date.now();
      accumulatedMsRef.current = 0;
      setSeconds(mode === 'countdown' ? initialSeconds : 0);
      setState('running');
    }
  };

  const pause = () => {
    if (state === 'running' && startedAtRef.current) {
      accumulatedMsRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
      setState('paused');
    }
  };

  const resume = () => {
    if (state === 'paused') {
      startedAtRef.current = Date.now();
      setState('running');
    }
  };

  const reset = (newSeconds?: number) => {
    if (newSeconds !== undefined) {
      initialSecondsRef.current = newSeconds;
    }
    startedAtRef.current = null;
    accumulatedMsRef.current = 0;
    setSeconds(newSeconds ?? (mode === 'countdown' ? initialSecondsRef.current : 0));
    setState('idle');
  };

  return {
    seconds,
    state,
    start,
    pause,
    resume,
    reset,
  };
}
