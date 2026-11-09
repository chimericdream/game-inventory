const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Nov 20" for a date-only string like "2026-11-20", the same on server and client. */
export function shortDate(iso: string): string {
  return MONTH.format(new Date(`${iso}T00:00:00Z`));
}

/** "Nov 20, 2026". */
export function longDate(iso: string): string {
  return MONTH_YEAR.format(new Date(`${iso}T00:00:00Z`));
}
