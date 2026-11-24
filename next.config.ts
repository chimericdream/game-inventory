import type { NextConfig } from 'next';

// Extra hostnames server actions accept requests from (reverse proxies, Tailscale names, ...),
// as a comma-separated list. Next.js bakes this config in at build time, so set it when you build.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
    // Cover uploads go through a server action; allow the full 8 MB cover limit plus form overhead
    // (the default is 1 MB, which silently rejected ordinary photos).
    serverActions: { bodySizeLimit: '10mb', allowedOrigins },
  },
};

export default nextConfig;
