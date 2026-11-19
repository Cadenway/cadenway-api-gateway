import { ProblemException } from '@cadenway/nest-common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskDetailPart } from '../../../../ports/outbound/detail-parts/details/task-detail-part.port.js';
import type { TaskDetailCoreSource } from '../../../../ports/outbound/task-service/details/task-detail-core-source.port.js';
import { GetTaskDetail } from './get-task-detail.use-case.js';

/**
 * The core of a detail, as task-service would answer it; the use case reads none of its members.
 */
const CORE: TaskServiceDocument = { task: { key: 'CAD-482' }, subtasks: [] };

/**
 * A source of the core answering `CORE`.
 *
 * @returns The source.
 */
function coreSource(): TaskDetailCoreSource {
  return { getTaskDetail: vi.fn(() => Promise.resolve(CORE)) };
}

/**
 * A secondary part answering what `read` resolves with.
 *
 * @param name - Name of the part.
 * @param read - What the part does.
 * @returns The part.
 */
function part(name: string, read: () => Promise<TaskServiceDocument>): TaskDetailPart {
  return { name, read: vi.fn(read) };
}

describe('GetTaskDetail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers the core with partial empty when no secondary part is bound, as in this version', async () => {
    const getTaskDetail = vi.fn(() => Promise.resolve(CORE));

    const detail = await new GetTaskDetail({ getTaskDetail }, []).execute('CAD-482');

    expect(getTaskDetail).toHaveBeenCalledWith('CAD-482');
    expect(detail).toEqual({ core: CORE, parts: new Map(), partial: [] });
  });

  it('keeps the parts that answered and names the failing one in partial', async () => {
    const attachments: TaskServiceDocument = { items: [] };

    const detail = await new GetTaskDetail(coreSource(), [
      part('attachments', () => Promise.resolve(attachments)),
      part('development', () => Promise.reject(new Error('integration-service is down'))),
    ]).execute('CAD-482');

    expect(detail.parts).toEqual(new Map([['attachments', attachments]]));
    expect(detail.partial).toEqual(['development']);
  });

  it('names a part that does not answer within 800 ms in partial, without waiting for it', async () => {
    vi.useFakeTimers();
    const slow: TaskDetailPart = part(
      'comments',
      () => new Promise<TaskServiceDocument>(() => undefined),
    );

    const pending: Promise<unknown> = new GetTaskDetail(coreSource(), [slow]).execute('CAD-482');
    await vi.advanceTimersByTimeAsync(799);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toEqual({ core: CORE, parts: new Map(), partial: ['comments'] });
  });

  it('reads the core and the parts together', async () => {
    const order: string[] = [];
    const source: TaskDetailCoreSource = {
      getTaskDetail: vi.fn(async () => {
        order.push('core started');
        await Promise.resolve();
        order.push('core answered');
        return CORE;
      }),
    };

    await new GetTaskDetail(source, [
      part('attachments', () => {
        order.push('part started');
        return Promise.resolve({});
      }),
    ]).execute('CAD-482');

    expect(order.indexOf('part started')).toBeLessThan(order.indexOf('core answered'));
  });

  it('fails as a whole when the core fails, whatever the parts answered', async () => {
    const failure: Error = new Error('task.not-found');
    const source: TaskDetailCoreSource = {
      getTaskDetail: vi.fn(() => Promise.reject(failure)),
    };

    await expect(
      new GetTaskDetail(source, [part('attachments', () => Promise.resolve({}))]).execute(
        'CAD-482',
      ),
    ).rejects.toBe(failure);
  });

  it('fails with the 404 task.trashed of the core and its details, never a partial detail', async () => {
    const details = {
      key: 'CAD-452',
      name: 'Ancien écran de connexion',
      entryId: '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01',
      rootKey: 'CAD-452',
      trashedAt: '2026-11-06T16:20:00Z',
      trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
      purgeAt: '2026-12-06T16:20:00Z',
      service: 'task-service',
    };
    const trashed: ProblemException = new ProblemException({
      status: 404,
      code: 'task.trashed',
      details,
    });
    const source: TaskDetailCoreSource = {
      getTaskDetail: vi.fn(() => Promise.reject(trashed)),
    };
    const attachments: TaskDetailPart = part('attachments', () => Promise.resolve({ items: [] }));

    const pending: Promise<unknown> = new GetTaskDetail(source, [attachments]).execute('CAD-452');

    await expect(pending).rejects.toBe(trashed);
    expect(trashed.problem).toMatchObject({ status: 404, code: 'task.trashed', details });
  });
});
