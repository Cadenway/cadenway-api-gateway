import type { KeyObject } from 'node:crypto';

import type { SprintReportCursorScope } from '../../../application/models/reporting/sprint-report-cursor-scope.model.js';
import type { SprintReportCursorCodec } from '../../../application/ports/outbound/crypto/reporting/sprint-report-cursor-codec.port.js';
import { Ed25519CursorEnvelope } from './ed25519-cursor-envelope.adapter.js';

/** Keeps the original order of the fields in a Sprint report signature. */
function reportBinding(scope: SprintReportCursorScope): readonly string[] {
  return [scope.organizationId, scope.userId, scope.listId, scope.today, scope.timeZone];
}

/** Signs bounded Sprint report cursors with the gateway's configured Ed25519 identity. */
export class Ed25519SprintReportCursor implements SprintReportCursorCodec {
  // #region Properties
  /** Signer for the original Sprint report envelope and signing domain. */
  private readonly envelope: Ed25519CursorEnvelope;
  // #endregion

  // #region Constructor
  /** Binds the validated signing key for the lifetime of the provider. */
  public constructor(signingKey: KeyObject) {
    this.envelope = new Ed25519CursorEnvelope(
      signingKey,
      'cadenway-api-gateway/sprint-report-cursor/v1',
    );
  }
  // #endregion

  // #region Methods
  /** Produces a versioned envelope with no private signing material. */
  public seal(innerCursor: string, scope: SprintReportCursorScope): string | null {
    return this.envelope.seal(innerCursor, reportBinding(scope));
  }

  /** Verifies the request binding and returns a bounded, canonical payload. */
  public open(cursor: string, scope: SprintReportCursorScope): string | null {
    return this.envelope.open(cursor, reportBinding(scope));
  }
  // #endregion
}
