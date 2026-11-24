// Container entrypoint: applies ALLOWED_ORIGINS at runtime, then starts the Next.js standalone server.
//
// Next.js bakes next.config.ts into server.js when it builds, so an env var read there is frozen
// into the published image. This rewrites the baked-in config from the container's environment
// instead, so one public image works for every deployment. If ALLOWED_ORIGINS is unset, the
// build-time value is left alone.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const serverFile = join(import.meta.dirname, 'server.js');
const raw = process.env.ALLOWED_ORIGINS;

if (raw !== undefined) {
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const source = readFileSync(serverFile, 'utf8');
  const line = /^const nextConfig = (.+)$/m;
  const match = line.exec(source);
  if (!match) {
    console.error('start-standalone: could not find the baked-in config in server.js');
    process.exit(1);
  }
  const config = JSON.parse(match[1]);
  config.experimental ??= {};
  config.experimental.serverActions = {
    ...config.experimental.serverActions,
    allowedOrigins: origins,
  };
  writeFileSync(
    serverFile,
    source.replace(line, () => `const nextConfig = ${JSON.stringify(config)}`),
  );
  console.log(`start-standalone: server actions accept origins: ${origins.join(', ') || '(none)'}`);
}

await import('./server.js');
