import { describe, expect, it } from 'vitest';

import type { InboxCursorScope } from '../../../../application/ports/outbound/crypto/inbox/inbox-page-cursor.port.js';
import { AesGcmInboxPageCursor } from './aes-gcm-inbox-page-cursor.adapter.js';

const scope: InboxCursorScope = {
  userId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e11',
  organizationId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e12',
  state: 'active',
};
const secret = Buffer.alloc(32, 0x5a);
const codec = new AesGcmInboxPageCursor(secret);
const position = Buffer.from(
  JSON.stringify({ createdAt: '2026-11-20T18:00:00.000Z', id: scope.userId }),
).toString('base64url');

/** Produces a real envelope for the negative tests. */
function sealedPosition(): string {
  const cursor = codec.seal(position, scope);
  if (cursor === null) throw new Error('The cursor fixture must fit the envelope.');
  return cursor;
}

describe('AesGcmInboxPageCursor', () => {
  it('encrypts the private position with a fresh nonce and opens on another replica', () => {
    const cursor = sealedPosition();
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(Buffer.from(cursor, 'base64url').includes(position)).toBe(false);
    expect(sealedPosition()).not.toBe(cursor);
    expect(new AesGcmInboxPageCursor(secret).open(cursor, scope)).toBe(position);
    expect(new AesGcmInboxPageCursor(Buffer.alloc(32, 0x6b)).open(cursor, scope)).toBeNull();
  });

  it.each<InboxCursorScope>([
    { ...scope, userId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e13' },
    { ...scope, organizationId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e14' },
    { ...scope, state: 'archived' },
  ])('binds the position to %j', (otherScope) => {
    expect(codec.open(sealedPosition(), otherScope)).toBeNull();
  });

  it('rejects plaintext, tampering, noncanonical encodings and oversized input', () => {
    const cursor = sealedPosition();
    const wrongVersion = Buffer.from(cursor, 'base64url');
    wrongVersion[0] = 2;
    const tampered = Buffer.from(cursor, 'base64url');
    tampered[1] = (tampered[1] ?? 0) ^ 1;
    for (const invalid of [
      position,
      `${cursor}=`,
      ` ${cursor}`,
      wrongVersion.toString('base64url'),
      tampered.toString('base64url'),
      'A'.repeat(1024),
    ]) {
      expect(codec.open(invalid, scope)).toBeNull();
    }
    expect(codec.seal('', scope)).toBeNull();
    expect(codec.seal('é'.repeat(257), scope)).toBeNull();
  });
});
