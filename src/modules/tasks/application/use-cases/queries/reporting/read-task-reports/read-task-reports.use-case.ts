import type { TaskReportingRegistry } from '../../../../ports/outbound/task-service/reporting/task-reporting-registry.port.js';

/** Relays authorized report reads to task-service. */
export class ReadTaskReports {
  // #region Constructor
  /** Binds the task reporting port. */
  public constructor(private readonly reports: TaskReportingRegistry) {}
  // #endregion

  // #region Methods
  /** Reads a dashboard or one authorized list report. */
  public execute(
    report: 'dashboard' | 'sprint' | 'workload' | 'timesheet',
    query: object,
    listId?: string,
    method?: 'QUERY',
  ): Promise<object> {
    if (report === 'dashboard') return this.reports.dashboard(query);
    if (listId === undefined) throw new Error('A list report requires a list identifier.');
    if (report === 'workload' && method === 'QUERY')
      return this.reports.workload(listId, query, method);
    return this.reports[report](listId, query);
  }
  // #endregion
}
