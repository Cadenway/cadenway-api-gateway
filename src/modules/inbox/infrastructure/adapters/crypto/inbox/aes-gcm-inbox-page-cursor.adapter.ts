import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

import type { InboxCursorScope } from '../../../../application/models/inbox/inbox-cursor-scope.model.js';
import type { InboxPageCursor } from '../../../../application/ports/outbound/crypto/inbox/inbox-page-cursor.port.js';

const VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const OVERHEAD_BYTES = 1 + NONCE_BYTES + TAG_BYTES;
const MAX_CURSOR_BYTES = 512;
const MAX_ENVELOPE_LENGTH = Math.ceil(((OVERHEAD_BYTES + MAX_CURSOR_BYTES) * 4) / 3);

/** Binds the envelope version, verified UUIDs and Inbox state without exposing them. */
function associatedData(scope: InboxCursorScope): Buffer {
  return Buffer.from(
    JSON.stringify([
      VERSION,
      scope.userId.toLowerCase(),
      scope.organizationId.toLowerCase(),
      scope.state,
    ]),
  );
}

/** Keeps the internal scan position confidential, including a hidden candidate at the boundary. */
export class AesGcmInboxPageCursor implements InboxPageCursor {
  // #region Properties
  /** Separate symmetric key derived once for this provider. */
  private readonly key: KeyObject;
  // #endregion

  // #region Constructor
  /** Derives the cursor key from the validated replica-shared signer secret. */
  public constructor(secret: Uint8Array) {
    this.key = createSecretKey(
      Buffer.from(
        hkdfSync(
          'sha256',
          secret,
          'cadenway-api-gateway/inbox',
          'page-cursor/aes-256-gcm/v1',
          KEY_BYTES,
        ),
      ),
    );
  }
  // #endregion

  // #region Methods
  /** Emits canonical base64url of version, random nonce, authentication tag and ciphertext. */
  public seal(cursor: string, scope: InboxCursorScope): string | null {
    const length = Buffer.byteLength(cursor);
    if (length === 0 || length > MAX_CURSOR_BYTES) return null;

    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(associatedData(scope));
    const ciphertext = Buffer.concat([cipher.update(cursor, 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), nonce, cipher.getAuthTag(), ciphertext]).toString(
      'base64url',
    );
  }

  /** Refuses noncanonical, oversized, unauthenticated and wrong-scope envelopes identically. */
  public open(cursor: string, scope: InboxCursorScope): string | null {
    if (cursor.length > MAX_ENVELOPE_LENGTH) return null;
    const envelope = Buffer.from(cursor, 'base64url');
    if (
      envelope.length <= OVERHEAD_BYTES ||
      envelope.length > OVERHEAD_BYTES + MAX_CURSOR_BYTES ||
      envelope[0] !== VERSION ||
      envelope.toString('base64url') !== cursor
    ) {
      return null;
    }

    const nonceEnd = 1 + NONCE_BYTES;
    const decipher = createDecipheriv(ALGORITHM, this.key, envelope.subarray(1, nonceEnd), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(associatedData(scope));
    decipher.setAuthTag(envelope.subarray(nonceEnd, OVERHEAD_BYTES));
    try {
      return Buffer.concat([
        decipher.update(envelope.subarray(OVERHEAD_BYTES)),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
  // #endregion
}
