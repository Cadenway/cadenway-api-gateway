import type { FactoryProvider } from '@nestjs/common';

import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskDetailCoreSource } from '../../../../application/ports/outbound/task-service/details/task-detail-core-source.port.js';
import { createTaskDetailCoreSourceAdapter } from '../../../../infrastructure/adapters/task-service/task-detail-core-source.adapter.js';
import { TASK_DETAIL_CORE_SOURCE } from '../../../tokens/details/task-detail-core-source.token.js';

/**
 * Constant taskDetailCoreSourceProvider
 *
 * @description
 * Binds the main part of the task detail to task-service.
 *
 * @type {FactoryProvider<TaskDetailCoreSource>}
 */
export const taskDetailCoreSourceProvider: FactoryProvider<TaskDetailCoreSource> = {
  provide: TASK_DETAIL_CORE_SOURCE,
  inject: [TaskServiceClient],
  useFactory: createTaskDetailCoreSourceAdapter,
};
