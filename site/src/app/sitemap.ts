import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib';

import { DOCS_NAV } from './docs/nav';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/` }, ...DOCS_NAV.map((item) => ({ url: `${SITE_URL}${item.href}` }))];
}
