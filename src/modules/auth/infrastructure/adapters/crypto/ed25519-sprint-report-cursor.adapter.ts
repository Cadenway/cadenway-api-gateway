import { createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

import type { SprintReportCursorScope } from '../../../application/models/reporting/sprint-report-cursor-scope.model.js';
import type { SprintReportCursorCodec } from '../../../application/ports/outbound/crypto/reporting/sprint-report-cursor-codec.port.js';

/** Task caps its opaque cursor at 2048 ASCII characters. */
const MAX_TASK_CURSOR_BYTES: number = 2048;

/** Leaves room in the public URL for the base64url payload, signature and version. */
const MAX_PUBLIC_CURSOR_LENGTH: number = 3072;

/**
 * Domain-separates these signatures from JWTs and binds each envelope to its request.
 * A NUL prefix deliberately cannot occur in a JWT signing input.
 */
function signingInput(encoded: string, scope: SprintReportCursorScope): Buffer {
  const fields = [
    scope.organizationId,
    scope.userId,
    scope.listId,
    scope.today,
    scope.timeZone,
    encoded,
  ];
  return Buffer.from(`\0cadenway-api-gateway/sprint-report-cursor/v1\0${JSON.stringify(fields)}`);
}

/** Signs bounded Sprint report cursors with the gateway's configured Ed25519 identity. */
export class Ed25519SprintReportCursor implements SprintReportCursorCodec {
  // #region Properties
  /** Public part of the signing key, cached for verification. */
  private readonly publicKey: KeyObject;
  // #endregion

  // #region Constructor
  /** Binds the validated signing key for the lifetime of the provider. */
  public constructor(private readonly signingKey: KeyObject) {
    this.publicKey = createPublicKey(signingKey);
  }
  // #endregion

  // #region Methods
  /** Produces a versioned envelope with no private signing material. */
  public seal(innerCursor: string, scope: SprintReportCursorScope): string | null {
    if (innerCursor.length === 0 || Buffer.byteLength(innerCursor) > MAX_TASK_CURSOR_BYTES) {
      return null;
    }
    const inner = Buffer.from(innerCursor);
    if (inner.toString() !== innerCursor) return null;

    const encoded = inner.toString('base64url');
    const signature = sign(null, signingInput(encoded, scope), this.signingKey).toString(
      'base64url',
    );
    return `v1.${encoded}.${signature}`;
  }

  /** Verifies the request binding and returns a bounded, canonical payload. */
  public open(cursor: string, scope: SprintReportCursorScope): string | null {
    if (cursor.length > MAX_PUBLIC_CURSOR_LENGTH) return null;
    const [version, encoded, signature, extra] = cursor.split('.');
    if (version !== 'v1' || !encoded || !signature || extra !== undefined) return null;

    const signed = Buffer.from(signature, 'base64url');
    if (signed.length !== 64 || signed.toString('base64url') !== signature) return null;
    if (!verify(null, signingInput(encoded, scope), this.publicKey, signed)) return null;

    const payload = Buffer.from(encoded, 'base64url');
    if (payload.length > MAX_TASK_CURSOR_BYTES || payload.toString('base64url') !== encoded)
      return null;
    const value = payload.toString();
    return Buffer.from(value).equals(payload) ? value : null;
  }
  // #endregion
}
