// UPC_BASE_URL exists so end-to-end tests can point at a mock server.
const BASE = process.env.UPC_BASE_URL ?? 'https://api.upcitemdb.com/prod/trial';

/** Looks up a product title for a barcode via UPCitemdb's free trial endpoint (rate limited). */
export async function lookupUpc(code: string): Promise<string | null> {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  const res = await fetch(`${BASE}/lookup?upc=${digits}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { title?: string }[] };
  const title = data.items?.[0]?.title?.trim();
  return title || null;
}
