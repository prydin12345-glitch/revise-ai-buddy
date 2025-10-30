// Calendar grid utility functions

export const START_HOUR = 8; // 8am
export const END_HOUR = 22; // 10pm
export const SLOT_INTERVAL = 60; // 60 minutes per slot

/**
 * Converts time string (HH:mm) to grid row position
 * @param time - Time string in format "HH:mm" (e.g., "09:00")
 * @returns Grid row number (1-indexed, where 1 = START_HOUR)
 */
export function timeToGridRow(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours - START_HOUR) * 60 + minutes;
  const row = Math.floor(totalMinutes / SLOT_INTERVAL) + 1;
  return Math.max(1, Math.min(row, END_HOUR - START_HOUR + 1));
}

/**
 * Converts duration in minutes to number of grid rows to span
 * @param duration - Duration in minutes
 * @returns Number of rows to span
 */
export function durationToRowSpan(duration: number): number {
  return Math.max(1, Math.ceil(duration / SLOT_INTERVAL));
}

/**
 * Gets all time slots for the day
 */
export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
}

/**
 * Converts day name to column index (1-7)
 */
export function dayToColumnIndex(day: string): number {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.indexOf(day.toLowerCase()) + 1;
}

/**
 * Formats time for display
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}${period}`;
}
