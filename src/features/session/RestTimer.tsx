import { useState, useEffect } from 'react';
import { Play, Pause, X, RotateCcw, Plus, HelpCircle, Activity } from 'lucide-react';
import { useTimer } from '../../hooks/useTimer';
import { HAPTIC } from '../../hooks/useHaptic';

interface RestTimerProps {
  duration: number; // rest seconds, e.g. 90
  onClose: () => void;
}

export default function RestTimer({ duration, onClose }: RestTimerProps) {
  const [timerMode, setTimerMode] = useState<'countdown' | 'stopwatch'>('countdown');
  const [initialSeconds, setInitialSeconds] = useState(duration);

  // play synthesized beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); // fade out

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  };

  const handleFinish = () => {
    HAPTIC.countdown_finish();
    playBeep();
  };

  const { seconds, state, start, pause, resume, reset } = useTimer({
    mode: timerMode,
    initialSeconds: initialSeconds,
    onFinish: handleFinish,
  });

  // Auto-start when component mounts
  useEffect(() => {
    start();
  }, [timerMode, initialSeconds]);

  // Toggle modes
  const handleToggleMode = () => {
    if (timerMode === 'countdown') {
      setTimerMode('stopwatch');
      reset(0);
    } else {
      setTimerMode('countdown');
      reset(initialSeconds);
    }
  };

  const handleAdd30s = () => {
    if (timerMode === 'countdown') {
      const newDuration = seconds + 30;
      setInitialSeconds(newDuration);
      reset(newDuration);
      // Wait for useEffect trigger, it will auto-start
    }
  };

  // Format MM:SS
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-6 shadow-2xl border-t border-slate-200 dark:border-slate-800 animate-slide-up space-y-6 pb-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-500 animate-pulse" />
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">
              Thời gian nghỉ ngơi
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Circular Display Indicator */}
        <div className="flex flex-col items-center justify-center py-4">
          <div className={`w-40 h-40 rounded-full border-4 flex flex-col items-center justify-center shadow-inner transition-all duration-300 ${
            state === 'finished' 
              ? 'border-emerald-500 bg-emerald-500/5 animate-pulse'
              : state === 'running' 
                ? 'border-primary-500 bg-primary-50/5' 
                : 'border-slate-300 bg-slate-50 dark:bg-slate-850'
          }`}>
            <span className="text-3xl font-black text-slate-850 dark:text-white tracking-tight">
              {formatTime(seconds)}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {timerMode === 'countdown' ? 'Nghỉ ngơi' : 'Đếm lên'}
            </span>
          </div>

          {state === 'finished' && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-3 animate-bounce">
              Hết giờ nghỉ! Bắt đầu set tiếp theo.
            </p>
          )}
        </div>

        {/* Timer Actions */}
        <div className="flex justify-center items-center gap-4">
          {/* Reset button */}
          <button
            onClick={() => reset(timerMode === 'countdown' ? initialSeconds : 0)}
            className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 rounded-full transition-colors"
            title="Đặt lại"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Pause / Resume */}
          {state === 'running' ? (
            <button
              onClick={pause}
              className="p-4 bg-primary-600 hover:bg-primary-750 text-white rounded-full shadow-lg shadow-primary-500/25 transition-transform active:scale-95"
              title="Tạm dừng"
            >
              <Pause className="w-6 h-6 fill-white" />
            </button>
          ) : (
            <button
              onClick={state === 'paused' ? resume : start}
              className="p-4 bg-primary-600 hover:bg-primary-750 text-white rounded-full shadow-lg shadow-primary-500/25 transition-transform active:scale-95"
              title="Bắt đầu"
            >
              <Play className="w-6 h-6 fill-white" />
            </button>
          )}

          {/* Mode Switcher */}
          <button
            onClick={handleToggleMode}
            className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-350 rounded-full transition-colors"
            title="Đổi chế độ"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {timerMode === 'countdown' ? (
            <button
              onClick={handleAdd30s}
              className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/30 text-indigo-650 dark:text-indigo-400 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Cộng 30s</span>
            </button>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-850 p-2.5 text-center text-[10px] text-slate-400 font-medium rounded-xl border flex items-center justify-center">
              Chế độ Bấm giờ
            </div>
          )}

          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-750 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors"
          >
            Bỏ qua nghỉ
          </button>
        </div>
        
      </div>
    </div>
  );
}
