import { ProblemException } from '@cadenway/nest-common';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { TaskDetailPart } from '../../../application/ports/outbound/detail-parts/details/task-detail-part.port.js';

/** Creates the comments detail part and classifies visibility denials. */
export function createTaskDetailCommentsAdapter(client: TaskServiceClient): TaskDetailPart {
  return {
    name: 'comments',
    read: (taskKey, signal) => client.listTaskComments(taskKey, {}, signal),
    failsDetail: (error) =>
      error instanceof ProblemException &&
      error.problem.status === 404 &&
      ['task.not-found', 'task.trashed', 'organization.not-found'].includes(error.problem.code),
  };
}
