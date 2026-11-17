import { describe, expect, it } from 'vitest';

import { toCurrentUser } from './current-user.mapper.js';

describe('toCurrentUser', () => {
  const account = {
    id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
    name: 'Camille Martin',
    email: 'camille@example.org',
    language: 'fr',
    version: 1,
  };

  it('supplies contract defaults while older identity instances omit profile fields', () => {
    expect(toCurrentUser(account)).toEqual({
      ...account,
      displayName: null,
      jobTitle: null,
      timeZone: 'Europe/Paris',
    });
  });

  it('preserves profile fields returned by identity', () => {
    const profile = { displayName: 'camille', jobTitle: 'Designer', timeZone: 'Europe/London' };
    expect(toCurrentUser({ ...account, ...profile })).toEqual({ ...account, ...profile });
  });

  it('passes on when the password was last set, once identity sends it', () => {
    const user = toCurrentUser({ ...account, passwordChangedAt: '2026-08-12T09:30:00Z' });

    expect(user).toMatchObject({ passwordChangedAt: '2026-08-12T09:30:00Z' });
    expect(toCurrentUser(account)).not.toHaveProperty('passwordChangedAt');
  });

  it('never passes on a member the public contract does not declare', () => {
    const user = toCurrentUser({ ...account, mfaEnabled: true } as typeof account);

    expect(user).not.toHaveProperty('mfaEnabled');
  });
});
