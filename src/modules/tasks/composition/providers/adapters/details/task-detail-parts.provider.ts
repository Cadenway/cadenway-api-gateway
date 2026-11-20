import type { FactoryProvider } from '@nestjs/common';

import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskDetailPart } from '../../../../application/ports/outbound/detail-parts/details/task-detail-part.port.js';
import { createTaskDetailCommentsAdapter } from '../../../../infrastructure/adapters/task-service/task-detail-comments.adapter.js';
import { TASK_DETAIL_PARTS } from '../../../tokens/details/task-detail-parts.token.js';

/**
 * Constant taskDetailPartsProvider
 *
 * @description
 * Binds the comments page as a secondary part of the task detail.
 *
 * @type {FactoryProvider<readonly TaskDetailPart[]>}
 */
export const taskDetailPartsProvider: FactoryProvider<readonly TaskDetailPart[]> = {
  provide: TASK_DETAIL_PARTS,
  inject: [TaskServiceClient],
  useFactory: (client: TaskServiceClient): readonly TaskDetailPart[] => [
    createTaskDetailCommentsAdapter(client),
  ],
};
