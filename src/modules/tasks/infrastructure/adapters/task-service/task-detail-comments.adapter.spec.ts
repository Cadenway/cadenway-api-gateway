import { ProblemException } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import { GetTaskDetail } from '../../../application/use-cases/queries/details/get-task-detail/get-task-detail.use-case.js';
import { createTaskDetailCommentsAdapter } from './task-detail-comments.adapter.js';

describe('task detail comments adapter', () => {
  it('forwards the cancellation signal to the Tasks client', async () => {
    const page = { items: [], nextCursor: null, total: 0 };
    const listTaskComments = vi.fn().mockResolvedValue(page);
    const client = { listTaskComments } as unknown as TaskServiceClient;
    const { signal } = new AbortController();

    await expect(createTaskDetailCommentsAdapter(client).read('CAD-482', signal)).resolves.toBe(
      page,
    );
    expect(listTaskComments).toHaveBeenCalledWith('CAD-482', {}, signal);
  });

  it.each(['task.not-found', 'task.trashed', 'organization.not-found'])(
    'fails closed for 404 %s',
    async (code) => {
      const error = new ProblemException({ status: 404, code });
      const client = {
        listTaskComments: vi.fn().mockRejectedValue(error),
      } as unknown as TaskServiceClient;
      const detail = new GetTaskDetail({ getTaskDetail: () => Promise.resolve({ task: {} }) }, [
        createTaskDetailCommentsAdapter(client),
      ]);
      await expect(detail.execute('CAD-482')).rejects.toBe(error);
    },
  );

  it.each([
    new ProblemException({ status: 403, code: 'auth.issuer-not-allowed' }),
    new ProblemException({ status: 404, code: 'comment.not-found' }),
    new ProblemException({ status: 404, code: '' }),
    new ProblemException({ status: 503, code: 'upstream.failed' }),
    new Error('invalid body'),
  ])('marks comments partial for non-visibility failures', async (error) => {
    const client = {
      listTaskComments: vi.fn().mockRejectedValue(error),
    } as unknown as TaskServiceClient;
    const detail = new GetTaskDetail({ getTaskDetail: () => Promise.resolve({ task: {} }) }, [
      createTaskDetailCommentsAdapter(client),
    ]);
    await expect(detail.execute('CAD-482')).resolves.toEqual({
      core: { task: {} },
      parts: new Map(),
      partial: ['comments'],
    });
  });
});
