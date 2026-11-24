import { describe, expect, it } from 'vitest';

import { diskLevel, formatBytes } from './bytes';

const GB = 1024 ** 3;

describe('formatBytes', () => {
  it('picks a sensible unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(300 * 1024)).toBe('300 KB');
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3.4 MB');
    expect(formatBytes(250 * 1024 * 1024)).toBe('250 MB');
    expect(formatBytes(128 * GB)).toBe('128 GB');
    expect(formatBytes(2 * 1024 * GB)).toBe('2.0 TB');
  });

  it('copes with nonsense', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('diskLevel', () => {
  it('warns at 80% and goes critical at 90%', () => {
    expect(diskLevel(50 * GB, 100 * GB)).toBe('ok');
    expect(diskLevel(79 * GB, 100 * GB)).toBe('ok');
    expect(diskLevel(80 * GB, 100 * GB)).toBe('warning');
    expect(diskLevel(89 * GB, 100 * GB)).toBe('warning');
    expect(diskLevel(90 * GB, 100 * GB)).toBe('critical');
    expect(diskLevel(100 * GB, 100 * GB)).toBe('critical');
  });

  it('treats an unknown size as fine', () => {
    expect(diskLevel(0, 0)).toBe('ok');
  });
});
