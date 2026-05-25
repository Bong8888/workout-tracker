import { db } from '../db';

export async function vibrate(pattern: number | number[]) {
  if (!('vibrate' in navigator)) return;
  try {
    const settings = await db.settings.get('singleton');
    if (settings && !settings.haptic_enabled) return;
    navigator.vibrate(pattern);
  } catch (e) {
    console.warn('Vibration failed:', e);
  }
}

// Preset patterns for mobile workout feedback
export const HAPTIC = {
  tap: () => vibrate(15),
  success: () => vibrate([50, 40, 50]),
  countdown_finish: () => vibrate([150, 50, 150, 50, 300]),
};
