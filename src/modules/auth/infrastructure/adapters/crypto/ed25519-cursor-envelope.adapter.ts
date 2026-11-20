import { createPublicKey, sign, verify, type KeyObject } from 'node:crypto';

/** Bounds the inner cursor before it becomes a URL-safe envelope. */
const MAX_CURSOR_BYTES: number = 2048;

/** Leaves room in the public URL for the base64url payload, signature and version. */
const MAX_PUBLIC_CURSOR_LENGTH: number = 3072;

/** Seals canonical cursor envelopes for one purpose using the configured gateway key. */
export class Ed25519CursorEnvelope {
  // #region Properties
  /** Public part of the signing key, cached for verification. */
  private readonly publicKey: KeyObject;
  // #endregion

  // #region Constructor
  /** Binds one versioned signing domain to the lifetime of its provider. */
  public constructor(
    private readonly signingKey: KeyObject,
    private readonly domain: string,
  ) {
    this.publicKey = createPublicKey(signingKey);
  }
  // #endregion

  // #region Methods
  /** Produces a signed envelope bound to the supplied ordered request fields. */
  public seal(innerCursor: string, binding: readonly string[]): string | null {
    if (innerCursor.length === 0 || Buffer.byteLength(innerCursor) > MAX_CURSOR_BYTES) {
      return null;
    }
    const inner = Buffer.from(innerCursor);
    if (inner.toString() !== innerCursor) return null;

    const encoded = inner.toString('base64url');
    const signature = sign(null, this.signingInput(encoded, binding), this.signingKey).toString(
      'base64url',
    );
    return `v1.${encoded}.${signature}`;
  }

  /** Verifies the request binding and returns a bounded, canonical payload. */
  public open(cursor: string, binding: readonly string[]): string | null {
    if (cursor.length > MAX_PUBLIC_CURSOR_LENGTH) return null;
    const [version, encoded, signature, extra] = cursor.split('.');
    if (version !== 'v1' || !encoded || !signature || extra !== undefined) return null;

    const signed = Buffer.from(signature, 'base64url');
    if (signed.length !== 64 || signed.toString('base64url') !== signature) return null;
    if (!verify(null, this.signingInput(encoded, binding), this.publicKey, signed)) return null;

    const payload = Buffer.from(encoded, 'base64url');
    if (payload.length > MAX_CURSOR_BYTES || payload.toString('base64url') !== encoded) return null;
    const value = payload.toString();
    return Buffer.from(value).equals(payload) ? value : null;
  }

  /** Prefixes the signed fields with the purpose and a NUL outside JWT signing inputs. */
  private signingInput(encoded: string, binding: readonly string[]): Buffer {
    return Buffer.from(`\0${this.domain}\0${JSON.stringify([...binding, encoded])}`);
  }
  // #endregion
}
