import { db } from './index';
import type { AppSettings } from './types';

/**
 * Seeds default settings into the database if the database is currently empty.
 * Exercises seeding is deferred to Phase 3.
 */
export async function seedIfEmpty() {
  const existingSettings = await db.settings.get('singleton');
  if (!existingSettings) {
    const defaultSettings: AppSettings = {
      id: 'singleton',
      theme: 'system',
      default_rest_seconds: 90,
      default_workout_timer_mode: 'stopwatch',
      default_rest_timer_mode: 'countdown',
      default_bodyweight_kg: 70,
      haptic_enabled: true,
    };
    await db.settings.add(defaultSettings);
    console.log('Database initialized: default AppSettings seeded.');
  }
}
