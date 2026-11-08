export interface Account {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'member' | 'restricted';
  storageState: string;
}

export const ADMIN: Account = {
  name: 'Ada Admin',
  email: 'admin@e2e.test',
  password: 'e2e-admin-pass-1',
  role: 'admin',
  storageState: 'e2e/.tmp/auth/admin.json',
};

export const MEMBER: Account = {
  name: 'Mo Member',
  email: 'member@e2e.test',
  password: 'e2e-member-pass-1',
  role: 'member',
  storageState: 'e2e/.tmp/auth/member.json',
};

export const KID: Account = {
  name: 'Kit Kid',
  email: 'kid@e2e.test',
  password: 'e2e-kid-pass-1',
  role: 'restricted',
  storageState: 'e2e/.tmp/auth/kid.json',
};

export const ACCOUNTS = [ADMIN, MEMBER, KID];
