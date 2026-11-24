import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskReportingRegistry } from '../../../../application/ports/outbound/task-service/reporting/task-reporting-registry.port.js';

/** Connects the report port to the generated service client. */
export function createTaskReportingRegistry(client: TaskServiceClient): TaskReportingRegistry {
  return {
    dashboard: (query) => client.getTeamDashboard(query),
    sprint: (listId, query) => client.getSprintReport(listId, query),
    workload: (listId, query, method) =>
      method === 'QUERY'
        ? client.queryGetListWorkload(listId, query)
        : client.getListWorkload(listId, query),
    timesheet: (listId, query) => client.getListTimesheet(listId, query),
  };
}
