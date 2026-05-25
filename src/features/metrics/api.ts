import { db } from '../../db';
import type { BodyMetric } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';

export async function getAllBodyMetrics(): Promise<BodyMetric[]> {
  return db.bodyMetrics.orderBy('date').reverse().toArray();
}

export async function getLatestBodyMetric(): Promise<BodyMetric | undefined> {
  return db.bodyMetrics.orderBy('date').reverse().first();
}

export async function createBodyMetric(data: {
  date: string;
  weight_kg: number;
  body_fat_percent?: number;
  notes?: string;
}): Promise<string> {
  const existing = await db.bodyMetrics.where('date').equals(data.date).first();
  
  if (existing) {
    await db.bodyMetrics.update(existing.id, {
      weight_kg: data.weight_kg,
      body_fat_percent: data.body_fat_percent,
      notes: data.notes?.trim() || undefined,
    });
    return existing.id;
  }

  const id = crypto.randomUUID();
  await db.bodyMetrics.add({
    id,
    date: data.date,
    weight_kg: data.weight_kg,
    body_fat_percent: data.body_fat_percent,
    notes: data.notes?.trim() || undefined,
  });

  return id;
}

export async function updateBodyMetric(id: string, data: Partial<BodyMetric>): Promise<void> {
  await db.bodyMetrics.update(id, data);
}

export async function deleteBodyMetric(id: string): Promise<void> {
  await db.bodyMetrics.delete(id);
}

export async function getBodyweightAtDate(date: string): Promise<number> {
  // Find metric on or before date
  const metric = await db.bodyMetrics
    .where('date')
    .belowOrEqual(date)
    .reverse()
    .first();

  if (metric) return metric.weight_kg;

  const settings = await db.settings.get('singleton');
  if (settings && settings.default_bodyweight_kg) {
    return settings.default_bodyweight_kg;
  }
  return 70; // Fallback
}

// React Hooks
export function useBodyMetricsLive() {
  return useLiveQuery(() => getAllBodyMetrics(), [], []);
}

export function useLatestBodyMetricLive() {
  return useLiveQuery(() => getLatestBodyMetric(), [], undefined);
}
