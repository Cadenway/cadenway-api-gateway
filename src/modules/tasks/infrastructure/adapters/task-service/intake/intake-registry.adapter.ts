import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { IntakeRegistry } from '../../../../application/ports/outbound/task-service/intake/intake-registry.port.js';

/** Binds intake operations to the generated task-service client. */
export function createIntakeRegistry(client: TaskServiceClient): IntakeRegistry {
  return {
    getConfiguration: (id) => client.getIntakeFormConfiguration(id),
    updateConfiguration: (id, body, version) =>
      client.updateIntakeFormConfiguration(id, body, version),
    publish: (id, version) => client.publishIntakeForm(id, version),
    disable: async (id, version) => ({ version: await client.disableIntakeForm(id, version) }),
    contact: (key) => client.getTaskIntakeContact(key),
    getPublic: (key) => client.getPublicIntakeForm(key),
    submit: (key, body, idempotencyKey, draftKey) =>
      client.submitPublicIntakeForm(key, body, idempotencyKey, draftKey),
  };
}
