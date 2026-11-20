import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { SavedViewsRegistry } from '../../../application/ports/outbound/task-service/views/saved-views-registry.port.js';

/** Binds the port to the validating task-service client. */
export function createSavedViewsRegistry(client: TaskServiceClient): SavedViewsRegistry {
  return {
    listSavedViews: (listId, query) => client.listSavedViews(listId, query),
    createSavedView: (listId, body, key) => client.createSavedView(listId, body, key),
    getSavedView: (listId, viewId) => client.getSavedView(listId, viewId),
    updateSavedView: (listId, viewId, body, ifMatch) =>
      client.updateSavedView(listId, viewId, body, ifMatch),
    deleteSavedView: (listId, viewId, ifMatch) => client.deleteSavedView(listId, viewId, ifMatch),
    duplicateSavedView: (listId, viewId, body, ifMatch, key) =>
      client.duplicateSavedView(listId, viewId, body, ifMatch, key),
  };
}
