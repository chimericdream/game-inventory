import type { Locator, Page } from '@playwright/test';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mantine appends " *" to required labels, so plain exact matching misses them. */
export const label = (text: string) => new RegExp(`^${escapeRe(text)}( \\*)?$`);

/** The password field. The visibility toggle also carries a "password" label, so be specific. */
export const PASSWORD = /^Password( \*)?$/;

/** The form that contains a given submit button. Settings has several forms with the same labels. */
export function formWith(page: Page, buttonName: string | RegExp): Locator {
  return page.locator('form').filter({ has: page.getByRole('button', { name: buttonName }) });
}

/** Opens a Mantine Select (found by label inside `scope`) and chooses an option. */
export async function choose(
  page: Page,
  scope: Page | Locator,
  text: string,
  option: string | RegExp,
): Promise<void> {
  await scope.getByRole('combobox', { name: label(text) }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}

/** Opens a Mantine Select identified by its placeholder (used by the filter bar). */
export async function chooseByPlaceholder(
  page: Page,
  placeholder: string,
  option: string | RegExp,
): Promise<void> {
  await page.getByPlaceholder(placeholder, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
}
