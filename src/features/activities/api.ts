import { db } from '../../db';
import type { ActivityLog } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';

export async function getAllActivities(): Promise<ActivityLog[]> {
  return db.activityLogs.orderBy('date').reverse().toArray();
}

export async function getActivitiesByDate(date: string): Promise<ActivityLog[]> {
  return db.activityLogs.where('date').equals(date).toArray();
}

export async function createActivity(data: {
  date: string;
  activity_type: string;
  duration_minutes: number;
  notes?: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await db.activityLogs.add({
    id,
    date: data.date,
    activity_type: data.activity_type,
    duration_minutes: data.duration_minutes,
    notes: data.notes?.trim() || undefined,
    created_at: new Date().toISOString(),
  });
  return id;
}

export async function updateActivity(id: string, data: Partial<ActivityLog>): Promise<void> {
  await db.activityLogs.update(id, data);
}

export async function deleteActivity(id: string): Promise<void> {
  await db.activityLogs.delete(id);
}

// React Hooks
export function useActivitiesLive() {
  return useLiveQuery(() => getAllActivities(), [], []);
}

export function useTodayActivitiesLive(date: string) {
  return useLiveQuery(() => getActivitiesByDate(date), [date], []);
}
