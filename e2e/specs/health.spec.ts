import { expect, test } from '../fixtures';

test('X-07 health endpoint reports ok and leaks no config @smoke', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});
