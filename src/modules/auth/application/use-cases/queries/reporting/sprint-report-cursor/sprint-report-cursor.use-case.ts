import type { SprintReportCursorScope } from '../../../../models/reporting/sprint-report-cursor-scope.model.js';
import type { SprintReportCursorCodec } from '../../../../ports/outbound/crypto/reporting/sprint-report-cursor-codec.port.js';

/** Protects the opaque Task cursor that crosses the public API. */
export class SprintReportCursor {
  // #region Constructor
  /** Binds the gateway's cursor codec. */
  public constructor(private readonly codec: SprintReportCursorCodec) {}
  // #endregion

  // #region Methods
  /** Seals or opens the cursor for the request, returning null if it cannot be used. */
  public execute(
    action: 'seal' | 'open',
    cursor: string,
    scope: SprintReportCursorScope,
  ): string | null {
    return action === 'seal' ? this.codec.seal(cursor, scope) : this.codec.open(cursor, scope);
  }
  // #endregion
}
