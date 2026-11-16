import { expect, test } from '../fixtures';

test('X-07 health endpoint reports ok and leaks no config @smoke', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('X-08 /healthz follows the healthz convention and leaks no config @smoke', async ({
  request,
}) => {
  const res = await request.get('/healthz');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
  expect(body.message).toBeUndefined();
});
