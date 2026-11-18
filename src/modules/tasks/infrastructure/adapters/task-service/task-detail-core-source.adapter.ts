import type { TaskDetailCoreSource } from '../../../application/ports/outbound/task-service/details/task-detail-core-source.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createTaskDetailCoreSourceAdapter
 *
 * @description
 * Binds the main part of the task detail to the validating technical client of task-service.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {TaskDetailCoreSource} Local adapter for the capability.
 */
export function createTaskDetailCoreSourceAdapter(client: TaskServiceClient): TaskDetailCoreSource {
  return {
    getTaskDetail: (taskKey) => client.getTaskDetail(taskKey),
  };
}
