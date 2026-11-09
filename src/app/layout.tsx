import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import type { Metadata } from 'next';
import { figtree, fraunces } from '@/fonts';
import { mantineHtmlProps } from '@mantine/core';

import { Providers } from './Providers';

/**
 * Same logic as Mantine's <ColorSchemeScript />, rendered from this server component. The Mantine
 * component is a client component, and React 19 warns when a client component renders a <script>.
 */
const COLOR_SCHEME_SCRIPT = `try {
  var stored = window.localStorage.getItem("mantine-color-scheme-value");
  var scheme = stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  var computed = scheme !== "auto" ? scheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computed);
} catch (e) {}`;

export const metadata: Metadata = {
  title: 'Game Library',
  description: 'Our family game library',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`} {...mantineHtmlProps}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
