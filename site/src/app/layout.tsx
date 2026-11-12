import '@mantine/core/styles.css';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { figtree, fraunces } from '@app/fonts';
import { mantineHtmlProps } from '@mantine/core';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from '@/lib';

import { Providers } from './Providers';

/** Same logic as the app: follow the saved choice, else the system, before first paint. */
const COLOR_SCHEME_SCRIPT = `try {
  var stored = window.localStorage.getItem("mantine-color-scheme-value");
  var scheme = stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  var computed = scheme !== "auto" ? scheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computed);
} catch (e) {}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: ${TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${TAGLINE}`,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e7e7e0' },
    { media: '(prefers-color-scheme: dark)', color: '#121816' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`} {...mantineHtmlProps}>
      <body>
        <Script id="color-scheme" strategy="beforeInteractive">
          {COLOR_SCHEME_SCRIPT}
        </Script>
        <Providers>
          <a className="skip" href="#main">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
