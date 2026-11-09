export interface DueStatus {
  label: string;
  tone: 'overdue' | 'soon';
}

const DAY = 86_400_000;
const days = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const plural = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** What to say about a due date, or null when it is comfortably far off (or there is none). */
export function dueStatus(dueOn: string | null, today: string): DueStatus | null {
  if (!dueOn) return null;
  const left = days(dueOn) - days(today);
  if (left < 0) return { label: `Overdue ${plural(-left)}`, tone: 'overdue' };
  if (left === 0) return { label: 'Due today', tone: 'soon' };
  if (left <= 3)
    return { label: left === 1 ? 'Due tomorrow' : `Due in ${left} days`, tone: 'soon' };
  return null;
}
