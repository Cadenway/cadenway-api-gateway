import type { FactoryProvider } from '@nestjs/common';

import { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskDetailPart } from '../../../../application/ports/outbound/detail-parts/details/task-detail-part.port.js';
import { createTaskDetailDevelopmentAdapter } from '../../../../infrastructure/adapters/integration-service/details/task-detail-development.adapter.js';
import { createTaskDetailCommentsAdapter } from '../../../../infrastructure/adapters/task-service/task-detail-comments.adapter.js';
import { TASK_DETAIL_PARTS } from '../../../tokens/details/task-detail-parts.token.js';

/**
 * Constant taskDetailPartsProvider
 *
 * @description
 * Binds the secondary parts of the task detail, in the order `partial` names them: the comments
 * page from task-service, then the Git links (`development`) from integration-service.
 *
 * @type {FactoryProvider<readonly TaskDetailPart[]>}
 */
export const taskDetailPartsProvider: FactoryProvider<readonly TaskDetailPart[]> = {
  provide: TASK_DETAIL_PARTS,
  inject: [TaskServiceClient, IntegrationServiceClient],
  useFactory: (
    client: TaskServiceClient,
    integration: IntegrationServiceClient,
  ): readonly TaskDetailPart[] => [
    createTaskDetailCommentsAdapter(client),
    createTaskDetailDevelopmentAdapter(integration),
  ],
};
