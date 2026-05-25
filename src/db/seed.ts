import { db } from './index';
import type { AppSettings } from './types';
import exercisesData from '../data/exercises.json';

/**
 * Seeds default settings and exercise library into the database if empty.
 */
export async function seedIfEmpty() {
  // 1. Seed exercises if empty
  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) {
    await db.exercises.bulkAdd(exercisesData as any);
    console.log(`Database initialized: Seeded ${exercisesData.length} exercises.`);
  }

  // 2. Seed settings if empty
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
