import type { AccessRequestRegistry } from '../../../application/ports/outbound/task-service/access-requests/access-request-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createAccessRequestRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it. None of these calls is retried.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {AccessRequestRegistry} Local adapter for the capability.
 */
export function createAccessRequestRegistryAdapter(
  client: TaskServiceClient,
): AccessRequestRegistry {
  return {
    createAccessRequest: (creation) => client.createAccessRequest(creation),
    listAccessRequests: (query) => client.listAccessRequests(query),
    approveAccessRequest: (accessRequestId, approval) =>
      client.approveAccessRequest(accessRequestId, approval),
    refuseAccessRequest: (accessRequestId, refusal) =>
      client.refuseAccessRequest(accessRequestId, refusal),
  };
}
