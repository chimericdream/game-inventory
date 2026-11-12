import Link from 'next/link';

import classes from './Docs.module.css';
import { DOCS_NAV } from './nav';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={classes.layout}>
      <nav className={classes.side} aria-label="Documentation">
        <p className={classes.sideTitle}>Docs</p>
        <ul>
          {DOCS_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className={classes.prose}>{children}</article>
    </div>
  );
}
