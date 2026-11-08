export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.AUTO_MIGRATE === 'false') return;
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const { runMigrations } = await import('./server/db/migrate');
  await runMigrations(url, process.env.MIGRATIONS_DIR ?? './drizzle');
}
