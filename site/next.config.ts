import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A fully static site: `next build` writes plain files to site/out, which any host can serve.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // The site borrows the app's theme, fonts and shelf components from ../src, so the two can never
  // drift apart. Turbopack needs the repository root to be allowed to read them.
  turbopack: { root: path.resolve(import.meta.dirname, '..') },
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
};

export default nextConfig;
