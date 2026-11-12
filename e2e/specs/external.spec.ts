// Barcode/UPC lookup, and a wiring check that the app talks to the mock server rather than the
// internet. The BoardGameGeek screens themselves are deliberately not exercised here yet; see
// docs/E2E_TEST_PLAN.md (BGG-xx).
import { expect, test } from '../fixtures';
import { BGG_TOKEN, MOCK_URL } from '../support/env';
import { png, TINY_PNG } from '../support/images';

interface Logged {
  service: string;
  path: string;
  query: Record<string, string>;
  authorization: string | null;
}

const requests = async (service: 'bgg' | 'upc'): Promise<Logged[]> =>
  (await fetch(`${MOCK_URL}/__requests?service=${service}`)).json();

test.beforeEach(async () => {
  await fetch(`${MOCK_URL}/__reset`);
});

test('UPC-01 a known barcode returns its product title @external', async ({ request }) => {
  const res = await request.get('/api/lookup/upc?code=012345678905');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ title: 'Catan Board Game' });
  const log = await requests('upc');
  expect(log).toHaveLength(1);
  expect(log[0]!.query.upc).toBe('012345678905');
});

test('UPC-02 unknown codes and upstream failures give an empty answer, not an error @external', async ({
  request,
}) => {
  for (const code of [
    '999999999999', // unknown
    '429429429429', // rate limited
    '500500500500', // upstream error
    '777777777777', // malformed JSON
  ]) {
    const res = await request.get(`/api/lookup/upc?code=${code}`);
    expect(res.status(), code).toBe(200);
    expect(await res.json(), code).toEqual({ title: null });
  }
});

test('UPC-03 codes of the wrong length never reach the upstream service @external', async ({
  request,
}) => {
  for (const code of ['', '123', '1234567', '123456789012345', 'abcdefgh']) {
    const res = await request.get(`/api/lookup/upc?code=${encodeURIComponent(code)}`);
    expect(await res.json(), code).toEqual({ title: null });
  }
  expect(await requests('upc')).toHaveLength(0);
});

test('UPC-04 non-digits in a code are stripped before the lookup @external', async ({
  request,
}) => {
  const res = await request.get('/api/lookup/upc?code=0-12345-67890-5');
  expect(await res.json()).toEqual({ title: 'Catan Board Game' });
});

test('UPC-05 scanning a barcode fills the search with the product title @external', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeDetector {
      async detect() {
        return [{ rawValue: '012345678905' }];
      }
    }
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = FakeDetector;
  });
  await page.goto('/games/new');
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  await expect(page.getByPlaceholder('Search a title to fill in the details')).toHaveValue(
    'Catan Board Game',
  );
  expect((await requests('upc')).map((r) => r.query.upc)).toEqual(['012345678905']);
});

test('UPC-06 without BarcodeDetector support the scan button is not offered', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
  });
  await page.goto('/games/new');
  await expect(page.getByPlaceholder('Search a title to fill in the details')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scan barcode' })).toHaveCount(0);
});

test('MOCK-01 the app reaches the mock BGG with its token, not the real service @external', async ({
  request,
}) => {
  const res = await request.get('/api/lookup/bgg?q=catan');
  expect(res.status()).toBe(200);
  const { hits } = await res.json();
  expect(hits).toHaveLength(1);
  expect(hits[0]).toMatchObject({ id: 13, name: 'Catan', year: 1995, isExpansion: false });
  expect(hits[0].publisher).toBe('Kosmos');

  const log = await requests('bgg');
  expect(log.map((l) => l.path)).toEqual(['/bgg/search', '/bgg/thing']);
  expect(log[0]!.authorization).toBe(`Bearer ${BGG_TOKEN}`);
});

test('MOCK-02 a lookup is two requests per search (results, then their covers) and one per pick, with nothing in the background @external', async ({
  request,
  page,
}) => {
  await request.get('/api/lookup/bgg?q=pandemic');
  await request.get('/api/lookup/bgg?id=30549');
  await page.goto('/games');
  await page.goto('/games/new');
  await page.waitForTimeout(500); // nothing should be polling the upstream service
  const log = await requests('bgg');
  expect(log.map((l) => l.path)).toEqual(['/bgg/search', '/bgg/thing', '/bgg/thing']);
});

test('MOCK-03 upstream failures reach the caller as a 502 with a message @external', async ({
  request,
}) => {
  for (const q of ['__500', '__garbage']) {
    const res = await request.get(`/api/lookup/bgg?q=${q}`);
    expect(res.status(), q).toBe(502);
    expect((await res.json()).error).toBeTruthy();
  }
  const preparing = await request.get('/api/lookup/bgg?q=__202');
  expect(preparing.status()).toBe(502);
  expect((await preparing.json()).error).toMatch(/try again/i);
});

test('MOCK-04 at most ten search results come back @external', async ({ request }) => {
  const { hits } = await (await request.get('/api/lookup/bgg?q=__many')).json();
  expect(hits).toHaveLength(10);
});

test('LOOK-01 picking a match fills the form and says what it filled @external', async ({
  page,
}) => {
  await page.goto('/games/new');
  await page.getByPlaceholder('Search a title to fill in the details').fill('catan');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Catan (1995)' }).click();

  await expect(page.getByLabel('Title *')).toHaveValue('Catan');
  await expect(page.getByLabel('Min players')).toHaveValue('3');
  await expect(page.getByLabel('Max players')).toHaveValue('4');
  await expect(page.getByLabel('Publisher')).toHaveValue('Kosmos');
  const note = page.locator('[data-lookup-filled]');
  await expect(note).toContainText('Filled in');
  await expect(note).toContainText('players');
  await expect(note).toContainText('publisher');
  await expect(note).toContainText('Check the details, then save.');
});

test('LOOK-02 a failed lookup offers to try again @external', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/lookup/bgg**', async (route) => {
    calls++;
    if (calls === 1) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'BoardGameGeek did not answer.' }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto('/games/new');
  await page.getByPlaceholder('Search a title to fill in the details').fill('catan');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('BoardGameGeek did not answer.')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Catan (1995)' })).toBeVisible();
  await expect(page.getByText('BoardGameGeek did not answer.')).toHaveCount(0);
});

// The mock image host's cover (a different PNG from the one tests upload).
const MOCK_COVER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function lookUpCatan(page: import('@playwright/test').Page) {
  await page.goto('/games/new');
  await page.getByPlaceholder('Search a title to fill in the details').fill('catan');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Catan (1995)' }).click();
  // The form remounts once the result arrives, so wait for that before touching it.
  await expect(page.locator('[data-lookup-filled]')).toBeVisible();
}

test('LOOK-03 a lookup cover is downloaded by the server and saved with the game @external', async ({
  page,
}) => {
  await lookUpCatan(page);
  await expect(page.locator('[data-lookup-filled]')).toContainText('cover');
  await expect(page.locator('[data-bgg-cover]')).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);

  const res = await page.request.get(`/api/games/${page.url().split('/').pop()}/cover`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  // The bytes are the mock image host's, so the server fetched it.
  expect(Buffer.compare(await res.body(), MOCK_COVER)).toBe(0);
});

test('LOOK-04 an uploaded cover wins over the lookup cover @external', async ({ page }) => {
  await lookUpCatan(page);
  await page.locator('input[type="file"]').setInputFiles(png('mine.png'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);

  const res = await page.request.get(`/api/games/${page.url().split('/').pop()}/cover`);
  expect(res.status()).toBe(200);
  expect(Buffer.compare(await res.body(), TINY_PNG)).toBe(0);
});

test('EXPLOOK-01 search results mark expansions, and picking one fills it in as an expansion @external', async ({
  page,
}) => {
  await page.goto('/games/new');
  await page.getByPlaceholder('Search a title to fill in the details').fill('seafar');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: 'Seafarers (1997) · expansion' }).click();
  await expect(page.locator('[data-lookup-filled]')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'This is an expansion' })).toBeChecked();
  await expect(page.getByLabel('Max players')).toHaveValue('6');
});

test('EXPLOOK-02 a base game lists its BGG expansions, each one click from a filled form @external', async ({
  page,
}) => {
  // Add Catan from the lookup so its BGG id is kept, plus one expansion we already own.
  await lookUpCatan(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);
  const baseUrl = page.url();

  await page.getByRole('link', { name: 'Add expansion' }).click();
  const list = page.locator('[data-bgg-expansions]');
  await expect(list.getByRole('button', { name: /Cities & Knights/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /Seafarers/ })).toBeVisible();

  await list.getByRole('button', { name: /Seafarers/ }).click();
  await expect(page.locator('[data-lookup-filled]')).toBeVisible();
  await expect(page.getByLabel('Title *')).toHaveValue('Seafarers');
  await expect(page.getByRole('combobox', { name: 'Base game' })).toHaveValue('Catan');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // Back on Catan, listing the new expansion; and the lookup now marks it as owned.
  await expect(page).toHaveURL(baseUrl);
  await expect(page.locator('[data-expansions] li').filter({ hasText: 'Seafarers' })).toBeVisible();
  await page.getByRole('link', { name: 'Add expansion' }).click();
  await expect(
    page.locator('[data-bgg-expansions]').getByRole('button', { name: /Seafarers.*In library/ }),
  ).toBeVisible();
});

test('EXPLOOK-03 picking an expansion from a general search finds its base game by name @external', async ({
  page,
}) => {
  await lookUpCatan(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/games\/[0-9a-f-]{36}$/);

  await page.goto('/games/new');
  await page.getByPlaceholder('Search a title to fill in the details').fill('cities');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /Cities & Knights/ }).click();
  await expect(page.locator('[data-lookup-filled]')).toContainText('base game');
  await expect(page.getByRole('combobox', { name: 'Base game' })).toHaveValue('Catan');
});
