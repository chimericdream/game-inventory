// pnpm shots: clears screenshots/ and runs the screenshot project against the e2e stack.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

try {
  rmSync('screenshots', { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
} catch (err) {
  console.warn('Could not clear screenshots/ (' + err.code + '); stale files may remain.');
}
const r = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--project=screenshots', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, E2E_SCREENSHOTS: '1' },
  },
);
process.exit(r.status ?? 1);
