import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { SprintReportCursorScope } from '../../../application/models/reporting/sprint-report-cursor-scope.model.js';
import { Ed25519SprintReportCursor } from './ed25519-sprint-report-cursor.adapter.js';

const scope: SprintReportCursorScope = {
  organizationId: '01900000-0000-7000-8000-000000000001',
  userId: '01900000-0000-7000-8000-000000000002',
  listId: '01900000-0000-7000-8000-000000000003',
  today: '2026-11-20',
  timeZone: 'Europe/Paris',
};
const key = generateKeyPairSync('ed25519').privateKey;
const codec = new Ed25519SprintReportCursor(key);
const innerCursor = Buffer.from('{"after":"2026-11-18","snapshot":"900:910:902,906"}').toString(
  'base64url',
);

/** Fails the fixture setup if a cursor cannot be sealed. */
function sealedCursor(): string {
  const cursor = codec.seal(innerCursor, scope);
  if (cursor === null) throw new Error('The fixture should fit in the public cursor.');
  return cursor;
}

describe('Ed25519SprintReportCursor', () => {
  it('preserves the upstream cursor across instances using the same key', () => {
    const otherInstance = new Ed25519SprintReportCursor(key);
    expect(otherInstance.open(sealedCursor(), scope)).toBe(innerCursor);
  });

  it.each([
    { organizationId: '01900000-0000-7000-8000-000000000004' },
    { userId: '01900000-0000-7000-8000-000000000004' },
    { listId: '01900000-0000-7000-8000-000000000004' },
    { today: '2026-11-21' },
    { timeZone: 'UTC' },
  ])('refuses a change to any bound request field (%j)', (change) => {
    expect(codec.open(sealedCursor(), { ...scope, ...change })).toBeNull();
  });

  it('refuses altered, noncanonical or unsigned cursors', () => {
    const cursor = sealedCursor();
    const dot = cursor.lastIndexOf('.');
    const originalFirstSignatureChar = cursor.charAt(dot + 1);
    const otherChar = originalFirstSignatureChar === 'A' ? 'B' : 'A';
    const tampered = cursor.slice(0, dot + 1) + otherChar + cursor.slice(dot + 2);
    expect(codec.open(tampered, scope)).toBeNull();
    expect(codec.open(cursor + '=', scope)).toBeNull();
    expect(codec.open(cursor + '.', scope)).toBeNull();
    expect(codec.open(cursor.replace(/^v1\./u, 'v2.'), scope)).toBeNull();
    expect(codec.open(innerCursor, scope)).toBeNull();
  });

  it('refuses a cursor issued with a different key', () => {
    const differentKey = new Ed25519SprintReportCursor(generateKeyPairSync('ed25519').privateKey);
    expect(differentKey.open(sealedCursor(), scope)).toBeNull();
  });

  it('accepts the full Task cursor size and bounds both representations', () => {
    const raw = 'YUA3'.repeat(512);
    const cursor = codec.seal(raw, scope);
    if (cursor === null) throw new Error('The maximum Task cursor should fit.');
    expect(cursor.length).toBeLessThan(3072);
    expect(codec.open(cursor, scope)).toBe(raw);
    expect(codec.seal(raw + 'a', scope)).toBeNull();
    expect(codec.seal('', scope)).toBeNull();
    expect(codec.open('x'.repeat(3073), scope)).toBeNull();
  });
});
