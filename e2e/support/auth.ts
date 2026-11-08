import { expect, type Page } from '@playwright/test';

import { PASSWORD } from './mantine';
import type { Account } from './roles';

export async function login(page: Page, account: Pick<Account, 'email' | 'password'>) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel(PASSWORD).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/games$/);
}
