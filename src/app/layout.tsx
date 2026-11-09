import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import type { Metadata } from 'next';
import Script from 'next/script';
import { figtree, fraunces } from '@/fonts';
import { mantineHtmlProps } from '@mantine/core';

import { Providers } from './Providers';

/**
 * Same logic as Mantine's <ColorSchemeScript />, loaded through next/script so React 19 does not
 * warn about a raw <script> tag in the component tree.
 */
const COLOR_SCHEME_SCRIPT = `try {
  var stored = window.localStorage.getItem("mantine-color-scheme-value");
  var scheme = stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  var computed = scheme !== "auto" ? scheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computed);
} catch (e) {}`;

export const metadata: Metadata = {
  title: 'The Shelf',
  description: 'Our family game library',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`} {...mantineHtmlProps}>
      <body>
        <Script id="color-scheme" strategy="beforeInteractive">
          {COLOR_SCHEME_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
