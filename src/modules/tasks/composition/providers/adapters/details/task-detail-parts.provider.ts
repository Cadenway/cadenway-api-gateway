import type { FactoryProvider } from '@nestjs/common';

import type { TaskDetailPart } from '../../../../application/ports/outbound/detail-parts/details/task-detail-part.port.js';
import { TASK_DETAIL_PARTS } from '../../../tokens/details/task-detail-parts.token.js';

/**
 * Constant taskDetailPartsProvider
 *
 * @description
 * Binds the secondary parts of the task detail: none in this version, where task-service is the
 * only source. A later part (attachments, development links, comments) is one more adapter here,
 * with its member in the public mapping of the detail.
 *
 * @type {FactoryProvider<readonly TaskDetailPart[]>}
 */
export const taskDetailPartsProvider: FactoryProvider<readonly TaskDetailPart[]> = {
  provide: TASK_DETAIL_PARTS,
  useFactory: (): readonly TaskDetailPart[] => [],
};
