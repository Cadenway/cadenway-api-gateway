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
});
