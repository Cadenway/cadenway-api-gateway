import type { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskGitLinksRegistry } from '../../../../application/ports/outbound/integration-service/git-links/task-git-links-registry.port.js';

/**
 * Binds the Git links registry to the signed task-service and integration-service clients, both
 * called for the user and organization of the verified credential.
 *
 * @param {TaskServiceClient} tasks - The technical client of task-service.
 * @param {IntegrationServiceClient} integration - The technical client of integration-service.
 * @returns {TaskGitLinksRegistry} The registry.
 */
export function createTaskGitLinksRegistry(
  tasks: TaskServiceClient,
  integration: IntegrationServiceClient,
): TaskGitLinksRegistry {
  return {
    authorize: async (taskKey) => {
      await tasks.getTask(taskKey);
    },
    list: (taskKey, query) => integration.listTaskGitLinks(taskKey, query),
  };
}
