import { expect, type APIRequestContext, type Page } from '@playwright/test';

import { choose, label } from './mantine';

export interface NewGame {
  title: string;
  type?: 'Board game' | 'Card game' | 'RPG' | 'Video game' | 'Puzzle' | 'Other';
  minPlayers?: number;
  maxPlayers?: number;
  playTime?: number;
  complexity?: number;
  minAge?: number;
  system?: string;
  bookKind?: string;
  tags?: string;
  description?: string;
  notes?: string;
  visibility?:
    | 'Visible to everyone'
    | 'Hide images from restricted profiles'
    | 'Hide entirely from restricted profiles';
  shareable?: boolean;
  cover?: { name: string; mimeType: string; buffer: Buffer };
}

/** Fills the add/edit game form (does not submit). */
export async function fillGameForm(page: Page, g: NewGame): Promise<void> {
  await page.getByLabel(label('Title')).fill(g.title);
  if (g.type) await choose(page, page, 'Type', g.type);
  if (g.minPlayers !== undefined) await page.getByLabel('Min players').fill(String(g.minPlayers));
  if (g.maxPlayers !== undefined) await page.getByLabel('Max players').fill(String(g.maxPlayers));
  if (g.playTime !== undefined) await page.getByLabel('Play time (min)').fill(String(g.playTime));
  if (g.complexity !== undefined)
    await page.getByLabel('Complexity (1–5)').fill(String(g.complexity));
  if (g.minAge !== undefined) await page.getByLabel('Min age').fill(String(g.minAge));
  if (g.system !== undefined) await page.getByLabel('System').fill(g.system);
  if (g.bookKind !== undefined) await page.getByLabel('Book kind').fill(g.bookKind);
  if (g.tags !== undefined) await page.getByLabel('Tags').fill(g.tags);
  if (g.description !== undefined) await page.getByLabel('Description').fill(g.description);
  if (g.notes !== undefined) await page.getByLabel('Notes').fill(g.notes);
  if (g.visibility) await choose(page, page, 'Visibility in this household', g.visibility);
  if (g.shareable !== undefined) {
    const sw = page.getByRole('switch', { name: 'Allow on guest links' });
    if (g.shareable) await sw.check();
    else await sw.uncheck();
  }
  if (g.cover) await page.locator('input[type="file"]').setInputFiles(g.cover);
}

/** Adds a game through the UI and waits for the detail page. Returns the new game's id. */
export async function addGameViaUi(page: Page, g: NewGame): Promise<string> {
  await page.goto('/games/new');
  await fillGameForm(page, g);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);
  return page.url().split('/').pop()!;
}

export const gameCards = (page: Page) => page.locator('[data-game-card]');

// --- server action capture and replay -------------------------------------------------------

export interface CapturedAction {
  url: string;
  headers: Record<string, string>;
  body: Buffer;
}

/**
 * Runs `trigger` (a click that submits a server action form), aborts the resulting request so it
 * has no effect, and returns what would have been sent. Replaying it under another identity shows
 * whether the server itself enforces permissions, independent of what the UI offers.
 */
export async function captureAction(
  page: Page,
  issues: string[],
  trigger: () => Promise<void>,
): Promise<CapturedAction> {
  // Aborting the request makes the page log a failed fetch, possibly after this function returns.
  // That is expected here, so those errors are removed from the tally as they arrive.
  page.on('pageerror', (err) => {
    const at = issues.lastIndexOf(`pageerror: ${err.message}`);
    if (err.message === 'Failed to fetch' && at >= 0) issues.splice(at, 1);
  });
  let captured: CapturedAction | undefined;
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.headers()['next-action']) {
      captured = {
        url: req.url(),
        headers: req.headers(),
        body: req.postDataBuffer() ?? Buffer.alloc(0),
      };
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await trigger();
  await expect.poll(() => captured, { message: 'server action request was captured' }).toBeTruthy();
  await page.unroute('**/*');
  return captured!;
}

export async function replayAction(request: APIRequestContext, c: CapturedAction) {
  const keep = ['next-action', 'content-type', 'accept', 'next-router-state-tree'];
  const headers = Object.fromEntries(Object.entries(c.headers).filter(([k]) => keep.includes(k)));
  return request.post(c.url, { headers, data: c.body, maxRedirects: 0 });
}
