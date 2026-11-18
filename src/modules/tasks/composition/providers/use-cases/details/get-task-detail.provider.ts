import type { FactoryProvider } from '@nestjs/common';

import type { TaskDetailPart } from '../../../../application/ports/outbound/detail-parts/details/task-detail-part.port.js';
import type { TaskDetailCoreSource } from '../../../../application/ports/outbound/task-service/details/task-detail-core-source.port.js';
import { GetTaskDetail } from '../../../../application/use-cases/queries/details/get-task-detail/get-task-detail.use-case.js';
import { TASK_DETAIL_CORE_SOURCE } from '../../../tokens/details/task-detail-core-source.token.js';
import { TASK_DETAIL_PARTS } from '../../../tokens/details/task-detail-parts.token.js';

/**
 * Constant getTaskDetailProvider
 *
 * @description
 * Assembles the task detail aggregate with its main part and its secondary parts.
 *
 * @type {FactoryProvider<GetTaskDetail>}
 */
export const getTaskDetailProvider: FactoryProvider<GetTaskDetail> = {
  provide: GetTaskDetail,
  inject: [TASK_DETAIL_CORE_SOURCE, TASK_DETAIL_PARTS],
  useFactory: (core: TaskDetailCoreSource, parts: readonly TaskDetailPart[]): GetTaskDetail =>
    new GetTaskDetail(core, parts),
};
