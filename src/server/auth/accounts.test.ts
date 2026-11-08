import { beforeEach, describe, expect, it } from 'vitest';

import type { Db } from '../db/client';
import { createTestDb } from '../db/test-db';
import { authenticate, createUser, needsSetup, setupHousehold } from './accounts';
import { createSession, deleteSession, validateSession } from './sessions';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const setup = {
  householdName: 'Home',
  name: 'Ada',
  email: 'Ada@Example.com',
  password: 'hunter2hunter2',
};

describe('setup and login', () => {
  it('needs setup until the first household exists, then refuses a second setup', async () => {
    expect(await needsSetup(db)).toBe(true);
    await setupHousehold(db, setup);
    expect(await needsSetup(db)).toBe(false);
    await expect(setupHousehold(db, { ...setup, email: 'b@example.com' })).rejects.toThrow(
      /already/,
    );
  });

  it('authenticates with the right password and normalized email only', async () => {
    await setupHousehold(db, setup);
    expect(await authenticate(db, 'ada@example.com', setup.password)).not.toBeNull();
    expect(await authenticate(db, 'ada@example.com', 'wrong-password')).toBeNull();
    expect(await authenticate(db, 'nobody@example.com', setup.password)).toBeNull();
  });
});

describe('sessions', () => {
  it('validates a fresh token and rejects it after logout or with a bad token', async () => {
    const user = await setupHousehold(db, setup);
    const { token } = await createSession(db, user);
    expect((await validateSession(db, token))?.userId).toBe(user.id);
    expect(await validateSession(db, 'not-a-token')).toBeNull();
    await deleteSession(db, token);
    expect(await validateSession(db, token)).toBeNull();
  });

  it('creates restricted users in the same household', async () => {
    const admin = await setupHousehold(db, setup);
    const kid = await createUser(db, admin.householdId, {
      name: 'Kid',
      email: 'kid@example.com',
      password: 'kidpassword1',
      role: 'restricted',
    });
    expect(kid.householdId).toBe(admin.householdId);
    expect(kid.role).toBe('restricted');
  });
});
