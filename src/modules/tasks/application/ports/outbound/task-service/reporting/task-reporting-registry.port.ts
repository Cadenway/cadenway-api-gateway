/** Reads authorized reporting projections from task-service. */
export interface TaskReportingRegistry {
  // #region Methods
  /** Reads the caller's dashboard. */
  dashboard(query: object): Promise<object>;

  /** Reads a sprint report page. */
  sprint(listId: string, query: object): Promise<object>;

  /** Reads a workload page. */
  workload(listId: string, query: object, method?: 'QUERY'): Promise<object>;

  /** Reads a weekly timesheet page. */
  timesheet(listId: string, query: object): Promise<object>;
  // #endregion
}
