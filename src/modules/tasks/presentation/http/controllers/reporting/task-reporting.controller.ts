import {
  ExportListTasksParams,
  ExportListTasksQueryParams,
  GetListWorkloadParams,
  GetListWorkloadQueryParams,
  GetListWorkloadResponse,
  GetSprintReportParams,
  GetSprintReportQueryParams,
  GetSprintReportResponse,
} from '@cadenway/contracts/validators/public/lists';
import {
  GetTeamDashboardQueryParams,
  GetTeamDashboardResponse,
} from '@cadenway/contracts/validators/public/reports';
import {
  GetListTimesheetParams,
  GetListTimesheetQueryParams,
  GetListTimesheetResponse,
} from '@cadenway/contracts/validators/public/time';
import {
  getOrganizationContext,
  remainingBudgetMs,
  ZodValidationPipe,
} from '@cadenway/nest-common';
import { Controller, Get, Inject, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';

import { toQueryList } from '../../../../../../presentation/http/mappers/query-parameters.mapper.js';
import { verifiedCredentialOf } from '../../../../../../presentation/http/session/request-session.js';
import { publicProblem } from '../../../../../../problems/public-problem.js';
import { conformBody, outsideContract } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import type { ListTaskCsv } from '../../../../application/models/export/list-task-csv.model.js';
import { ListTaskExportUnavailable } from '../../../../application/models/export/list-task-export-unavailable.model.js';
import { ExportListTasks } from '../../../../application/use-cases/queries/export/export-list-tasks/export-list-tasks.use-case.js';
import { ReadTaskReports } from '../../../../application/use-cases/queries/reporting/read-task-reports/read-task-reports.use-case.js';
import { AuthenticateReportCursor } from '../../../../application/use-cases/queries/reporting/authenticate-report-cursor/authenticate-report-cursor.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};
const EXPORT: AcceptedProblems = {
  ...READ,
  422: ['list.export-row-limit-reached'],
};
const EXPORT_IDLE_TIMEOUT_MS = 30_000;
const EXPORT_QUERY = ExportListTasksQueryParams.extend({
  status: z.preprocess(toQueryList, ExportListTasksQueryParams.shape.status),
  priority: z.preprocess(toQueryList, ExportListTasksQueryParams.shape.priority),
  assignee: z.preprocess(toQueryList, ExportListTasksQueryParams.shape.assignee),
  label: z.preprocess(toQueryList, ExportListTasksQueryParams.shape.label),
});
const WORKLOAD_QUERY = GetListWorkloadQueryParams.extend({
  status: z.preprocess(toQueryList, GetListWorkloadQueryParams.shape.status),
  priority: z.preprocess(toQueryList, GetListWorkloadQueryParams.shape.priority),
  assignee: z.preprocess(toQueryList, GetListWorkloadQueryParams.shape.assignee),
  label: z.preprocess(toQueryList, GetListWorkloadQueryParams.shape.label),
});

/** Public reporting reads for the verified organization. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TaskReportingController {
  // #region Constructor
  /** Binds report reads, CSV export and sprint cursor authentication. */
  public constructor(
    @Inject(ReadTaskReports) private readonly reports: ReadTaskReports,
    @Inject(ExportListTasks) private readonly exportTasks: ExportListTasks,
    @Inject(AuthenticateReportCursor) private readonly cursor: AuthenticateReportCursor,
  ) {}
  // #endregion

  // #region Methods
  /** Reads the caller's team dashboard. */
  @Get('reports/team-dashboard')
  @CredentialGuard.requires({
    operationId: 'getTeamDashboard',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async dashboard(
    @Query(new ZodValidationPipe(GetTeamDashboardQueryParams))
    query: z.output<typeof GetTeamDashboardQueryParams>,
  ): Promise<z.output<typeof GetTeamDashboardResponse>> {
    const body = conformBody(
      'task-service',
      'getTeamDashboard',
      GetTeamDashboardResponse,
      await relayProblems({ 400: ['request.invalid'], 404: ['organization.not-found'] }, () =>
        this.reports.execute('dashboard', query),
      ),
    );
    if (
      body.today !== query.today ||
      body.timeZone !== query.timeZone ||
      body.weeks !== query.weeks
    ) {
      throw outsideContract(
        'task-service',
        'getTeamDashboard',
        'a dashboard for different filters',
      );
    }
    return body;
  }

  /** Reads one sprint report page with a caller-bound cursor. */
  @Get('lists/:listId/sprint-report')
  @CredentialGuard.requires({
    operationId: 'getSprintReport',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async sprint(
    @Param(new ZodValidationPipe(GetSprintReportParams))
    params: z.output<typeof GetSprintReportParams>,
    @Query(new ZodValidationPipe(GetSprintReportQueryParams))
    query: z.output<typeof GetSprintReportQueryParams>,
    @Req() request: Request,
  ): Promise<z.output<typeof GetSprintReportResponse>> {
    const organizationId = getOrganizationContext()?.organizationId;
    const userId = verifiedCredentialOf(request)?.userId;
    if (organizationId === undefined || organizationId === null || userId === undefined) {
      throw new Error('The report route requires a verified organization and user.');
    }
    const scope = {
      organizationId,
      userId,
      listId: params.listId.toLowerCase(),
      today: query.today,
      timeZone: query.timeZone,
    };
    const decoded =
      query.cursor === undefined ? undefined : this.cursor.execute('open', query.cursor, scope);
    if (decoded === null) {
      throw publicProblem({
        status: 400,
        code: 'request.invalid',
        detail: 'The request does not match its contract.',
        details: {
          issues: [{ in: 'query', path: 'cursor', code: 'invalid', message: 'Invalid cursor.' }],
        },
      });
    }
    const body = conformBody(
      'task-service',
      'getSprintReport',
      GetSprintReportResponse,
      await relayProblems(READ, () =>
        this.reports.execute('sprint', { ...query, cursor: decoded }, scope.listId),
      ),
    );
    if (body.listId.toLowerCase() !== scope.listId) {
      throw outsideContract('task-service', 'getSprintReport', 'a report for another list');
    }
    if (body.nextCursor === null) return body;
    const sealed = this.cursor.execute('seal', body.nextCursor, scope);
    if (sealed === null)
      throw outsideContract('task-service', 'getSprintReport', 'an invalid report cursor');
    return { ...body, nextCursor: sealed };
  }

  /** Reads the workload of one visible list. */
  @Get('lists/:listId/workload')
  @CredentialGuard.requires({
    operationId: 'getListWorkload',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async workload(
    @Param(new ZodValidationPipe(GetListWorkloadParams))
    params: z.output<typeof GetListWorkloadParams>,
    @Query(new ZodValidationPipe(WORKLOAD_QUERY)) query: z.output<typeof WORKLOAD_QUERY>,
  ): Promise<z.output<typeof GetListWorkloadResponse>> {
    const body = conformBody(
      'task-service',
      'getListWorkload',
      GetListWorkloadResponse,
      await relayProblems(READ, () => this.reports.execute('workload', query, params.listId)),
    );
    if (
      body.listId.toLowerCase() !== params.listId.toLowerCase() ||
      body.weekStart !== query.weekStart
    ) {
      throw outsideContract('task-service', 'getListWorkload', 'a report for another list');
    }
    return body;
  }

  /** Reads one week of time entries on a visible list. */
  @Get('lists/:listId/timesheet')
  @CredentialGuard.requires({
    operationId: 'getListTimesheet',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async timesheet(
    @Param(new ZodValidationPipe(GetListTimesheetParams))
    params: z.output<typeof GetListTimesheetParams>,
    @Query(new ZodValidationPipe(GetListTimesheetQueryParams))
    query: z.output<typeof GetListTimesheetQueryParams>,
  ): Promise<z.output<typeof GetListTimesheetResponse>> {
    const body = conformBody(
      'task-service',
      'getListTimesheet',
      GetListTimesheetResponse,
      await relayProblems(READ, () => this.reports.execute('timesheet', query, params.listId)),
    );
    if (
      body.listId.toLowerCase() !== params.listId.toLowerCase() ||
      body.weekStart !== query.weekStart
    ) {
      throw outsideContract('task-service', 'getListTimesheet', 'a report for another list');
    }
    return body;
  }

  /** Prepares the complete CSV before sending headers, then streams it under an idle timeout. */
  @Get('lists/:listId/tasks/export')
  @CredentialGuard.requires({
    operationId: 'exportListTasks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async export(
    @Param(new ZodValidationPipe(ExportListTasksParams))
    params: z.output<typeof ExportListTasksParams>,
    @Query(new ZodValidationPipe(EXPORT_QUERY)) query: z.output<typeof EXPORT_QUERY>,
    @Res() response: Response,
  ): Promise<void> {
    if (response.destroyed) return;
    const lifetime = new AbortController();
    const disconnect = (): void => {
      if (!response.writableFinished) lifetime.abort();
    };
    response.once('close', disconnect);
    let file: ListTaskCsv | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      file = await this.exportTasks.execute(
        params.listId,
        query,
        remainingBudgetMs(),
        lifetime.signal,
      );
      if (lifetime.signal.aborted) return;
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      response.setHeader('Content-Length', file.byteLength);
      if (response.req.method === 'HEAD') {
        response.end();
        return;
      }
      const content = Readable.from(file.stream(), { objectMode: false });
      const timer = setTimeout(() => {
        lifetime.abort();
      }, EXPORT_IDLE_TIMEOUT_MS);
      idleTimer = timer;
      content.on('data', () => {
        timer.refresh();
      });
      await pipeline(content, response, { signal: lifetime.signal });
    } catch (error) {
      if (lifetime.signal.aborted || response.headersSent) return;
      if (error instanceof ListTaskExportUnavailable) {
        throw publicProblem({
          status: 503,
          code: error.code,
          detail: 'The complete export could not be prepared.',
          details: { service: error.service },
        });
      }
      throw toPublicProblem(error, EXPORT);
    } finally {
      clearTimeout(idleTimer);
      response.off('close', disconnect);
      await file?.dispose();
    }
  }
  // #endregion
}
