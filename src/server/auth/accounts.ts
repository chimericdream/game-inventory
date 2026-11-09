import { count, eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Db } from '../db/client';
import { households, users } from '../db/schema';
import { ensurePlayerForUser } from '../data/players';
import { hashPassword, verifyPassword } from './password';

export const credentialsInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
});

export const setupInput = credentialsInput.extend({
  householdName: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
});

export async function needsSetup(db: Db): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(users);
  return (row?.n ?? 0) === 0;
}

/** First-run only: creates the household and its admin. Refuses once any user exists. */
export async function setupHousehold(db: Db, raw: z.input<typeof setupInput>) {
  const input = setupInput.parse(raw);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ n: count() }).from(users);
    if ((existing?.n ?? 0) > 0) throw new Error('Setup has already been completed');
    const [household] = await tx
      .insert(households)
      .values({ name: input.householdName })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        householdId: household!.id,
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'admin',
      })
      .returning();
    await ensurePlayerForUser(tx, user!);
    return user!;
  });
}

const DUMMY_HASH = 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64);

/** Returns the user on success, null on any failure (same timing for unknown emails). */
export async function authenticate(db: Db, email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user : null;
}

export const newUserInput = credentialsInput.extend({
  name: z.string().trim().min(1).max(100),
  role: z.enum(['admin', 'member', 'restricted']),
});

export async function createUser(db: Db, householdId: string, raw: z.input<typeof newUserInput>) {
  const input = newUserInput.parse(raw);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        householdId,
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
      })
      .returning();
    await ensurePlayerForUser(tx, user!);
    return user!;
  });
}
