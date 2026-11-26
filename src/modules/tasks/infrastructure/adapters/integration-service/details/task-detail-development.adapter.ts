import type { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import type { TaskDetailPart } from '../../../../application/ports/outbound/detail-parts/details/task-detail-part.port.js';

/**
 * Creates the `development` part of the task detail: the first page of the task's Git links from
 * integration-service. It is read after the core, since integration-service does not decide task
 * visibility, and every failure of it, a refusal included, only leaves the part out.
 *
 * @param {IntegrationServiceClient} client - The technical client of integration-service.
 * @returns {TaskDetailPart} The part.
 */
export function createTaskDetailDevelopmentAdapter(
  client: IntegrationServiceClient,
): TaskDetailPart {
  return {
    name: 'development',
    afterCore: true,
    read: (taskKey, signal) => client.listTaskGitLinks(taskKey, {}, signal),
  };
}
