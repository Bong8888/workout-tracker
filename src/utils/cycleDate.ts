import { differenceInDays, parseISO } from 'date-fns';

/**
 * Calculates today's 1-indexed day order in the training cycle.
 * Returns -1 if the cycle has not started yet (today is before start date).
 */
export function getTodayDayOrder(
  startDate: string,
  cycleLength: number,
  today: Date = new Date()
): number {
  if (cycleLength <= 0) return -1;

  // parse start date (e.g., YYYY-MM-DD)
  const start = parseISO(startDate);
  
  // Normalize both dates to midnight local time to count calendar days difference
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startNormalized = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  const daysDiff = differenceInDays(todayNormalized, startNormalized);

  if (daysDiff < 0) return -1;

  // day_order is 1-indexed
  return (daysDiff % cycleLength) + 1;
}
