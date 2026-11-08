import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
    // Cover uploads go through a server action; allow the full 8 MB cover limit plus form overhead
    // (the default is 1 MB, which silently rejected ordinary photos).
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
