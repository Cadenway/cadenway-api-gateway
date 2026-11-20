import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { ReminderCursorScope } from '../../../application/models/reminder/reminder-cursor-scope.model.js';
import { Ed25519ReminderCursor } from './ed25519-reminder-cursor.adapter.js';

const owner: ReminderCursorScope = {
  organizationId: '01900000-0000-7000-8000-000000000001',
  userId: '01900000-0000-7000-8000-000000000002',
};
const signingKey = generateKeyPairSync('ed25519').privateKey;
const codec = new Ed25519ReminderCursor(signingKey);
const position = JSON.stringify({
  remindAt: '2026-11-20T09:00:00.000Z',
  id: '01900000-0000-7000-8000-000000000003',
});

/** Seals a fixture position while keeping assertion inputs non-null. */
function seal(raw: string): string {
  const cursor = codec.seal(raw, owner);
  if (cursor === null) throw new Error('The fixture should fit in the reminder cursor.');
  return cursor;
}

describe('Ed25519ReminderCursor', () => {
  it('accepts a cursor signed for the current owner across instances', () => {
    const anotherInstance = new Ed25519ReminderCursor(signingKey);
    expect(anotherInstance.open(seal(position), owner)).toBe(position);
  });

  it.each([
    { organizationId: '01900000-0000-7000-8000-000000000004' },
    { userId: '01900000-0000-7000-8000-000000000004' },
  ])('refuses a cursor from another owner (%j)', (change) => {
    expect(codec.open(seal(position), { ...owner, ...change })).toBeNull();
  });

  it('signs the exact reminder domain and rejects another purpose with identical scope fields', () => {
    const encoded = Buffer.from(position).toString('base64url');
    const binding = JSON.stringify([owner.organizationId, owner.userId, encoded]);
    const input = Buffer.from(`\0cadenway-api-gateway/reminder-cursor/v1\0${binding}`);
    const signature = sign(null, input, signingKey).toString('base64url');
    expect(seal(position)).toBe(`v1.${encoded}.${signature}`);

    const otherInput = Buffer.from(`\0cadenway-api-gateway/sprint-report-cursor/v1\0${binding}`);
    const otherSignature = sign(null, otherInput, signingKey).toString('base64url');
    expect(codec.open(`v1.${encoded}.${otherSignature}`, owner)).toBeNull();
  });

  it('rejects altered, noncanonical and other-key envelopes', () => {
    const cursor = seal(position);
    const altered = cursor.replace(/^v1\.(.)/u, (_, first: string) =>
      first === 'A' ? 'v1.B' : 'v1.A',
    );
    const anotherKey = new Ed25519ReminderCursor(generateKeyPairSync('ed25519').privateKey);
    expect(codec.open(altered, owner)).toBeNull();
    expect(codec.open(cursor.replace(/^v1\./u, 'v2.'), owner)).toBeNull();
    expect(codec.open(`${cursor}=`, owner)).toBeNull();
    expect(codec.open(position, owner)).toBeNull();
    expect(anotherKey.open(cursor, owner)).toBeNull();
  });

  it('limits input bytes and public envelope length', () => {
    const raw = 'é'.repeat(1024);
    expect(codec.open(seal(raw), owner)).toBe(raw);
    expect(codec.seal(`${raw}x`, owner)).toBeNull();
    expect(codec.seal('', owner)).toBeNull();
    expect(codec.seal('\ud800', owner)).toBeNull();
    expect(codec.open('x'.repeat(3073), owner)).toBeNull();
  });
});
