import type { Page } from '@playwright/test';

/** Confirms the "are you sure" dialog that every deletion shows. */
export async function confirmDelete(page: Page, button = 'Move to trash') {
  await page.getByRole('dialog').getByRole('button', { name: button, exact: true }).click();
}
