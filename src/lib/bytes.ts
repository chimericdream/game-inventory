const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** "412 KB", "3.4 MB", "128 GB". One decimal below 10 of a unit, none above. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  return `${value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`;
}

export type DiskLevel = 'ok' | 'warning' | 'critical';

/** How worried to be about a disk: 80% used is a warning, 90% is critical. */
export function diskLevel(usedBytes: number, totalBytes: number): DiskLevel {
  if (totalBytes <= 0) return 'ok';
  const used = usedBytes / totalBytes;
  return used >= 0.9 ? 'critical' : used >= 0.8 ? 'warning' : 'ok';
}
