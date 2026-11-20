import type { ReportCursor } from '../../../../ports/outbound/task-service/reporting/report-cursor.port.js';

/** Authenticates the report cursor within the caller's verified scope. */
export class AuthenticateReportCursor {
  // #region Constructor
  /** Binds the report cursor port. */
  public constructor(private readonly cursor: ReportCursor) {}
  // #endregion

  // #region Methods
  /** Opens an incoming cursor or seals a task-service cursor. */
  public execute(
    action: 'seal' | 'open',
    cursor: string,
    scope: {
      readonly organizationId: string;
      readonly userId: string;
      readonly listId: string;
      readonly today: string;
      readonly timeZone: string;
    },
  ): string | null {
    return this.cursor.execute(action, cursor, scope);
  }
  // #endregion
}
