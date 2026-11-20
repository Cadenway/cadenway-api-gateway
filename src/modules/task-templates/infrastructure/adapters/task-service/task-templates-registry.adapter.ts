import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { TaskTemplatesRegistry } from '../../../application/ports/outbound/task-service/templates/task-templates-registry.port.js';

/** Binds the port to the validating task-service client. */
export function createTaskTemplatesRegistry(client: TaskServiceClient): TaskTemplatesRegistry {
  return {
    listTaskTemplates: (spaceId, query) => client.listTaskTemplates(spaceId, query),
    createTaskTemplate: (spaceId, body, key) => client.createTaskTemplate(spaceId, body, key),
    getTaskTemplate: (spaceId, templateId) => client.getTaskTemplate(spaceId, templateId),
    deleteTaskTemplate: (spaceId, templateId, ifMatch) =>
      client.deleteTaskTemplate(spaceId, templateId, ifMatch),
  };
}
