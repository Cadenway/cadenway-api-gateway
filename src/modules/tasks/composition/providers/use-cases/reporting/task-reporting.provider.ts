import type { FactoryProvider } from '@nestjs/common';

import { OrganizationServiceClient } from '../../../../../../clients/organization-service.client.js';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import { SprintReportCursor } from '../../../../../auth/public/reporting/sprint-report-cursor.js';
import type { TaskReportingRegistry } from '../../../../application/ports/outbound/task-service/reporting/task-reporting-registry.port.js';
import { ExportListTasks } from '../../../../application/use-cases/queries/export/export-list-tasks/export-list-tasks.use-case.js';
import { ReadTaskReports } from '../../../../application/use-cases/queries/reporting/read-task-reports/read-task-reports.use-case.js';
import { AuthenticateReportCursor } from '../../../../application/use-cases/queries/reporting/authenticate-report-cursor/authenticate-report-cursor.use-case.js';
import { DiskListTaskCsvSpoolFactory } from '../../../../infrastructure/adapters/files/export/disk-list-task-csv-spool.adapter.js';
import { createTaskReportingRegistry } from '../../../../infrastructure/adapters/task-service/reporting/task-reporting-registry.adapter.js';

const TASK_REPORTING_REGISTRY = Symbol('TaskReportingRegistry');

/** Binds report use cases to their validating generated clients. */
export const taskReportingProviders: readonly FactoryProvider[] = [
  {
    provide: TASK_REPORTING_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createTaskReportingRegistry,
  },
  {
    provide: ReadTaskReports,
    inject: [TASK_REPORTING_REGISTRY],
    useFactory: (reports: TaskReportingRegistry): ReadTaskReports => new ReadTaskReports(reports),
  },
  {
    provide: AuthenticateReportCursor,
    inject: [SprintReportCursor],
    useFactory: (cursor: SprintReportCursor): AuthenticateReportCursor =>
      new AuthenticateReportCursor(cursor),
  },
  {
    provide: ExportListTasks,
    inject: [TaskServiceClient, OrganizationServiceClient],
    useFactory: (tasks: TaskServiceClient, members: OrganizationServiceClient): ExportListTasks =>
      new ExportListTasks(
        {
          read: (listId, query, signal, method) =>
            method === 'QUERY'
              ? tasks.queryExportListTasks(listId, query, signal)
              : tasks.exportListTasks(listId, query, signal),
        },
        { lookup: (userIds, signal) => members.lookupMemberNames(userIds, signal) },
        new DiskListTaskCsvSpoolFactory(),
      ),
  },
];
