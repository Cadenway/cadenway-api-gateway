import { ProblemException } from '@cadenway/nest-common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import type { TaskDetailCoreSource } from '../../../../application/ports/outbound/task-service/details/task-detail-core-source.port.js';
import { GetTaskDetail } from '../../../../application/use-cases/queries/details/get-task-detail/get-task-detail.use-case.js';
import { createTaskDetailDevelopmentAdapter } from './task-detail-development.adapter.js';

/** The core of a detail, as task-service would answer it. */
const CORE = { task: { key: 'CAD-482' } };

/** An empty first page of Git links. */
const PAGE = { items: [], nextCursor: null };

/** A core source answering `CORE`. */
function core(): TaskDetailCoreSource {
  return { getTaskDetail: vi.fn(() => Promise.resolve(CORE)) };
}

/**
 * An integration client whose link read is the given mock.
 *
 * @param listTaskGitLinks - The link read.
 * @returns The client.
 */
function integration(
  listTaskGitLinks: IntegrationServiceClient['listTaskGitLinks'],
): IntegrationServiceClient {
  return { listTaskGitLinks } as unknown as IntegrationServiceClient;
}

describe('task detail development adapter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the first page of links after the core, with the cancellation signal', async () => {
    const read = vi.fn<IntegrationServiceClient['listTaskGitLinks']>(() => Promise.resolve(PAGE));
    const part = createTaskDetailDevelopmentAdapter(integration(read));
    const { signal } = new AbortController();

    expect(part).toMatchObject({ name: 'development', afterCore: true });
    await expect(part.read('CAD-482', signal)).resolves.toBe(PAGE);
    expect(read).toHaveBeenCalledWith('CAD-482', {}, signal);
  });

  it('carries the page in the detail', async () => {
    const detail = await new GetTaskDetail(core(), [
      createTaskDetailDevelopmentAdapter(integration(() => Promise.resolve(PAGE))),
    ]).execute('CAD-482');

    expect(detail).toEqual({ core: CORE, parts: new Map([['development', PAGE]]), partial: [] });
  });

  it.each([
    new ProblemException({ status: 503, code: 'upstream.unavailable' }),
    new ProblemException({ status: 503, code: 'upstream.unauthorized' }),
    new ProblemException({ status: 503, code: 'upstream.failed' }),
    new ProblemException({ status: 404, code: 'task.not-found' }),
    new Error('invalid body'),
  ])('degrades an integration failure to partial development: %s', async (error) => {
    const detail = await new GetTaskDetail(core(), [
      createTaskDetailDevelopmentAdapter(integration(() => Promise.reject(error))),
    ]).execute('CAD-482');

    expect(detail).toEqual({ core: CORE, parts: new Map(), partial: ['development'] });
  });

  it('degrades a read slower than 800 ms after the core to partial development', async () => {
    vi.useFakeTimers();
    const onAbort = vi.fn();
    const client = integration((_taskKey, _query, signal) => {
      signal?.addEventListener('abort', onAbort, { once: true });
      return new Promise(() => undefined);
    });

    const pending = new GetTaskDetail(core(), [createTaskDetailDevelopmentAdapter(client)]).execute(
      'CAD-482',
    );
    await vi.advanceTimersByTimeAsync(800);

    await expect(pending).resolves.toEqual({
      core: CORE,
      parts: new Map(),
      partial: ['development'],
    });
    expect(onAbort).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never reads the links when the core fails', async () => {
    const failure = new ProblemException({ status: 404, code: 'task.not-found' });
    const read = vi.fn<IntegrationServiceClient['listTaskGitLinks']>(() => Promise.resolve(PAGE));

    await expect(
      new GetTaskDetail({ getTaskDetail: () => Promise.reject(failure) }, [
        createTaskDetailDevelopmentAdapter(integration(read)),
      ]).execute('CAD-482'),
    ).rejects.toBe(failure);
    expect(read).not.toHaveBeenCalled();
  });
});
