export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const url = process.env.DATABASE_URL;
  if (!url) return;
  if (process.env.AUTO_MIGRATE !== 'false') {
    const { runMigrations } = await import('./server/db/migrate');
    await runMigrations(url, process.env.MIGRATIONS_DIR ?? './drizzle');
  }
  const { startTrashPurge } = await import('./server/trash-schedule');
  startTrashPurge();
}
