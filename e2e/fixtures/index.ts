import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import * as db from '../support/db';
import { BASE_URL } from '../support/env';
import { ADMIN, KID, MEMBER } from '../support/roles';

type Issues = string[];

/**
 * Records page errors and console errors. Network failures that tests trigger on purpose
 * (404s, 401s) show up as "Failed to load resource" console errors; those are asserted on
 * explicitly in the tests, so they are not treated as page bugs here.
 */
function attachGuard(page: Page, issues: Issues) {
  page.on('pageerror', (err) => issues.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.startsWith('Failed to load resource')) return;
    issues.push(`console.error: ${text}`);
  });
}

interface Fixtures {
  db: typeof db;
  /** Admin is the default `page`; these open other identities in their own contexts. */
  memberPage: Page;
  kidPage: Page;
  /** No cookies at all. */
  anonPage: Page;
  newPage: (storageState?: string) => Promise<Page>;
  issues: Issues;
  resetData: void;
  consoleGuard: void;
}

export const test = base.extend<Fixtures>({
  // Playwright fixtures need the destructuring pattern even when they use no other fixture.
  // oxlint-disable-next-line no-empty-pattern
  db: async ({}, use) => {
    await use(db);
  },

  // oxlint-disable-next-line no-empty-pattern
  issues: async ({}, use) => {
    await use([]);
  },

  // Every test starts from an empty catalog but keeps the role accounts.
  resetData: [
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await db.resetCatalog();
      await use();
    },
    { auto: true },
  ],

  consoleGuard: [
    async ({ page, issues }, use) => {
      attachGuard(page, issues);
      await use();
      expect(issues, 'unexpected browser errors').toEqual([]);
    },
    { auto: true },
  ],

  newPage: async ({ browser, issues }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (storageState) => {
      const context = await browser.newContext({ baseURL: BASE_URL, storageState });
      contexts.push(context);
      const page = await context.newPage();
      attachGuard(page, issues);
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },

  memberPage: async ({ newPage }, use) => use(await newPage(MEMBER.storageState)),
  kidPage: async ({ newPage }, use) => use(await newPage(KID.storageState)),
  anonPage: async ({ newPage }, use) => use(await newPage()),
});

export { expect };
export { ADMIN, KID, MEMBER };
export type { Browser };
