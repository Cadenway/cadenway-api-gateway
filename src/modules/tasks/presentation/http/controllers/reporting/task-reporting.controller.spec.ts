import {
  remainingBudgetMs,
  runWithDeadline,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type { Request, Response } from 'express';
import { PassThrough, Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  createFakeIdentity,
  TASKS_TOKEN,
} from '../../../../../../../tests/support/fake-identity.js';
import { expectPublicResponse } from '../../../../../../../tests/support/public-contract.js';
import { createRouteApplication } from '../../../../../../../tests/support/route-application.js';
import { attachVerifiedCredential } from '../../../../../../presentation/http/session/request-session.js';
import type { AuthenticateReportCursor } from '../../../../application/use-cases/queries/reporting/authenticate-report-cursor/authenticate-report-cursor.use-case.js';
import type { ListTaskExportFrame } from '../../../../application/models/export/list-task-export-frame.model.js';
import { ListTaskExportUnavailable } from '../../../../application/models/export/list-task-export-unavailable.model.js';
import { ExportListTasks } from '../../../../application/use-cases/queries/export/export-list-tasks/export-list-tasks.use-case.js';
import type { ReadTaskReports } from '../../../../application/use-cases/queries/reporting/read-task-reports/read-task-reports.use-case.js';
import { TaskReportingController } from './task-reporting.controller.js';

const organizationId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const listId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e02';
const userId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e03';

function exportCsv(
  controller: TaskReportingController,
  params: Parameters<TaskReportingController['export']>[0],
  query: Parameters<TaskReportingController['export']>[1],
  response: Response,
): Promise<void> {
  return runWithOrganizationContext(
    { organizationId, actor: { type: 'user', id: userId }, role: 'member', scopes: [] },
    () => controller.export(params, query, response),
  );
}

describe('TaskReportingController', () => {
  it('opens and reseals a sprint cursor for the verified request scope', async () => {
    const report = {
      listId,
      name: 'Sprint',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      observedAt: '2026-11-20T12:00:00Z',
      coverageStartedAt: null,
      openingPoints: null,
      delivered: null,
      remaining: null,
      projectedRemainingPoints: null,
      items: [],
      nextCursor: 'task-next',
      velocity: [],
    };
    const execute = vi.fn().mockResolvedValue(report);
    const protect = vi.fn().mockReturnValueOnce('task-cursor').mockReturnValueOnce('sealed-next');
    const controller = new TaskReportingController(
      { execute } as unknown as ReadTaskReports,
      {} as ExportListTasks,
      { execute: protect } as unknown as AuthenticateReportCursor,
    );
    const request = {} as Request;
    attachVerifiedCredential(request, { kind: 'session', id: userId, userId });
    const query = { today: '2026-11-20', timeZone: 'Europe/Paris', cursor: 'sealed', limit: 50 };
    const scope = { organizationId, userId, listId, today: query.today, timeZone: query.timeZone };

    const answer = await runWithOrganizationContext(
      { organizationId, actor: { type: 'user', id: userId }, role: 'member', scopes: [] },
      () => controller.sprint({ listId: listId.toUpperCase() }, query, request),
    );
    expect(protect).toHaveBeenNthCalledWith(1, 'open', 'sealed', scope);
    expect(execute).toHaveBeenCalledWith('sprint', { ...query, cursor: 'task-cursor' }, listId);
    expect(protect).toHaveBeenNthCalledWith(2, 'seal', 'task-next', scope);
    expect(answer.nextCursor).toBe('sealed-next');
  });

  it('refuses a malformed public sprint cursor before calling task-service', async () => {
    const execute = vi.fn();
    const reports = { execute } as unknown as ReadTaskReports;
    const cursor = {
      execute: vi.fn().mockReturnValue(null),
    } as unknown as AuthenticateReportCursor;
    const controller = new TaskReportingController(reports, {} as ExportListTasks, cursor);
    const request = {} as Request;
    attachVerifiedCredential(request, { kind: 'session', id: userId, userId });

    await expect(
      runWithOrganizationContext(
        { organizationId, actor: { type: 'user', id: userId }, role: 'member', scopes: [] },
        () =>
          controller.sprint(
            { listId },
            { today: '2026-11-20', timeZone: 'Europe/Paris', cursor: 'bad', limit: 50 },
            request,
          ),
      ),
    ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not set download headers when a required name lookup fails', async () => {
    const exportTasks = {
      execute: vi
        .fn()
        .mockRejectedValue(
          new ListTaskExportUnavailable('organization-service', 'upstream.unavailable'),
        ),
    } as unknown as ExportListTasks;
    const controller = new TaskReportingController(
      {} as ReadTaskReports,
      exportTasks,
      {} as AuthenticateReportCursor,
    );
    const setHeader = vi.fn();
    const response = Object.assign(new PassThrough(), { setHeader });

    await expect(
      exportCsv(
        controller,
        { listId },
        { level: 'roots', sort: 'manual' },
        response as unknown as Response,
      ),
    ).rejects.toMatchObject({
      problem: {
        status: 503,
        code: 'upstream.unavailable',
        details: { service: 'organization-service' },
      },
    });
    expect(setHeader).not.toHaveBeenCalled();
    expect(response.writableEnded).toBe(false);
    expect(response.listenerCount('close')).toBe(0);
  });

  it('uses the request budget and streams only after the file is ready', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn<ExportListTasks['execute']>().mockResolvedValue({
      filename: 'sprint-14.csv',
      byteLength: 7,
      stream: csvContent,
      dispose,
    });
    const controller = new TaskReportingController(
      {} as ReadTaskReports,
      { execute } as unknown as ExportListTasks,
      {} as AuthenticateReportCursor,
    );
    const bytes: Buffer[] = [];
    const response = Object.assign(
      new Writable({
        write(chunk: Buffer, _encoding, callback) {
          bytes.push(chunk);
          callback();
        },
      }),
      { setHeader: vi.fn(), req: { method: 'GET' } },
    );
    const query = { level: 'roots', sort: 'manual' } as const;

    await runWithDeadline(120_000, () =>
      exportCsv(controller, { listId }, query, response as unknown as Response),
    );

    expect(execute).toHaveBeenCalledExactlyOnceWith(
      organizationId,
      listId,
      query,
      expect.any(Number),
      expect.any(AbortSignal),
    );
    expect(execute.mock.calls[0]?.[3]).toBeGreaterThan(119_000);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="sprint-14.csv"',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Content-Length', 7);
    expect(Buffer.concat(bytes).toString('utf8')).toBe('"a"\r\n""');
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('cancels pending preparation when the response closes', async () => {
    const execute = vi.fn<ExportListTasks['execute']>().mockImplementation(
      (_organizationId, _listId, _query, _budget, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('Download cancelled.'));
            },
            { once: true },
          );
        }),
    );
    const controller = new TaskReportingController(
      {} as ReadTaskReports,
      { execute } as unknown as ExportListTasks,
      {} as AuthenticateReportCursor,
    );
    const response = Object.assign(new PassThrough(), { setHeader: vi.fn() });
    const done = exportCsv(
      controller,
      { listId },
      { level: 'roots', sort: 'manual' },
      response as unknown as Response,
    );
    response.destroy();

    await done;
    expect(execute.mock.calls[0]?.[4]?.aborted).toBe(true);
    expect(response.setHeader).not.toHaveBeenCalled();
  });

  it('closes an idle download and releases its file', async () => {
    vi.useFakeTimers();
    try {
      const dispose = vi.fn().mockResolvedValue(undefined);
      const execute = vi.fn<ExportListTasks['execute']>().mockResolvedValue({
        filename: 'sprint-14.csv',
        byteLength: 7,
        stream: csvContent,
        dispose,
      });
      const controller = new TaskReportingController(
        {} as ReadTaskReports,
        { execute } as unknown as ExportListTasks,
        {} as AuthenticateReportCursor,
      );
      const response = Object.assign(new Writable({ write: vi.fn() }), {
        setHeader: vi.fn(),
        req: { method: 'GET' },
      });
      const done = exportCsv(
        controller,
        { listId },
        { level: 'roots', sort: 'manual' },
        response as unknown as Response,
      );

      await vi.advanceTimersByTimeAsync(29_000);
      expect(dispose).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      await done;
      expect(response.destroyed).toBe(true);
      expect(dispose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('disposes a progressing download at the total transfer deadline', async () => {
    vi.useFakeTimers();
    try {
      const dispose = vi.fn().mockResolvedValue(undefined);
      const write = vi.fn((_chunk: Buffer, _encoding: string, callback: () => void) => {
        callback();
      });
      const stream = async function* (): AsyncGenerator<Uint8Array> {
        for (let index = 0; index < 8; index += 1) {
          yield Buffer.from('row\r\n');
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 20_000);
          });
        }
      };
      const execute = vi.fn<ExportListTasks['execute']>().mockResolvedValue({
        filename: 'sprint-14.csv',
        byteLength: 40,
        stream,
        dispose,
      });
      const controller = new TaskReportingController(
        {} as ReadTaskReports,
        { execute } as unknown as ExportListTasks,
        {} as AuthenticateReportCursor,
      );
      const response = Object.assign(new Writable({ write }), {
        setHeader: vi.fn(),
        req: { method: 'GET' },
      });
      const done = exportCsv(
        controller,
        { listId },
        { level: 'roots', sort: 'manual' },
        response as unknown as Response,
      );

      await vi.advanceTimersByTimeAsync(119_000);
      expect(write).toHaveBeenCalledTimes(6);
      expect(dispose).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      await done;
      expect(response.destroyed).toBe(true);
      expect(dispose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the export-specific budget on the actual authenticated Gateway route', async () => {
    const app = await createRouteApplication(createFakeIdentity());
    try {
      let budget: number | undefined;
      app.task.exportListTasks.mockImplementation(() => {
        budget = remainingBudgetMs();
        return Promise.resolve(headerOnlyProjection());
      });
      const response = await request(app.server)
        .get(`/v1/lists/${listId}/tasks/export`)
        .set('Authorization', `Bearer ${TASKS_TOKEN}`)
        .set('X-Request-Timeout-Ms', '1')
        .expect(200);

      expect(budget).toBeGreaterThan(110_000);
      expect(response.headers).toMatchObject({
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="sprint-14.csv"',
      });
      expect(response.text).toBe('"Nom"\r\n');
    } finally {
      await app.app.close();
    }
  });

  it.each(['get', 'query'] as const)(
    'rejects a stale organization before the %s CSV export and its stream',
    async (method) => {
      const handlerName = method === 'get' ? 'export' : 'queryExport';
      const original: unknown = Object.getOwnPropertyDescriptor(
        TaskReportingController.prototype,
        handlerName,
      )?.value;
      if (typeof original !== 'function') throw new Error('Export handler is missing.');
      const handler = vi.spyOn(TaskReportingController.prototype, handlerName);
      for (const key of Reflect.getMetadataKeys(original) as unknown[]) {
        Reflect.defineMetadata(key, Reflect.getMetadata(key, original), handler);
      }
      const app = await createRouteApplication(createFakeIdentity());
      try {
        const prepare = vi.spyOn(app.app.get(ExportListTasks), 'execute');
        const pending = (
          request(app.server)[method](`/v1/lists/${listId}/tasks/export`) as request.Test
        )
          .set('Authorization', `Bearer ${TASKS_TOKEN}`)
          .set('If-Organization-Match', organizationId);
        const response = method === 'query' ? await pending.send({}) : await pending;

        expectPublicResponse(method, '/v1/lists/{listId}/tasks/export', response);
        expect(response.status).toBe(412);
        expect(response.body).toMatchObject({ code: 'organization.context-changed' });
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.headers['content-disposition']).toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect(prepare).not.toHaveBeenCalled();
        expect(app.task.exportListTasks).not.toHaveBeenCalled();
      } finally {
        await app.app.close();
        handler.mockRestore();
      }
    },
  );
});

async function* csvContent(): AsyncGenerator<Uint8Array> {
  yield await Promise.resolve(Buffer.from('"a"\r\n', 'utf8'));
  yield Buffer.from('""', 'utf8');
}

async function* headerOnlyProjection(): AsyncGenerator<
  Exclude<ListTaskExportFrame, { readonly kind: 'row' }>
> {
  yield await Promise.resolve({ kind: 'metadata', filename: 'sprint-14.csv', header: '"Nom"' });
  yield { kind: 'complete', rowCount: 0 };
}
