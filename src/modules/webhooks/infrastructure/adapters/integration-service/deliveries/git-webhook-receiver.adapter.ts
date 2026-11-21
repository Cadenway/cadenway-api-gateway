import { ProblemException } from '@cadenway/nest-common';

import type { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import type { GitWebhookReceiver } from '../../../../application/ports/outbound/integration-service/deliveries/git-webhook-receiver.port.js';

type IntegrationOperations = Pick<
  IntegrationServiceClient,
  'receiveGitHubWebhook' | 'receiveGitLabWebhook'
>;

/** Reconstructs public problems without retaining provider details in causes or logs. */
async function relay(call: Promise<void>): Promise<void> {
  try {
    await call;
  } catch (error) {
    if (error instanceof ProblemException) {
      const { code, status } = error.problem;
      if (status === 403 && code === 'webhook.authentication-failed') {
        throw new ProblemException({ status: 401, code });
      }
      if (
        (status === 400 &&
          [
            'request.invalid',
            'request.body-too-large',
            'http.bad-request',
            'webhook.invalid-delivery',
          ].includes(code)) ||
        (status === 401 && code === 'webhook.authentication-failed') ||
        (status === 503 && (code === 'integration.unavailable' || code.startsWith('upstream.')))
      ) {
        throw new ProblemException({ status, code });
      }
    }
    throw new ProblemException({ status: 503, code: 'upstream.failed' });
  }
}

/** Uses the generated client while keeping provider bytes and selected headers intact. */
export function createGitWebhookReceiver(client: IntegrationOperations): GitWebhookReceiver {
  return {
    github: (input) => relay(client.receiveGitHubWebhook(input)),
    gitlab: (input) => relay(client.receiveGitLabWebhook(input)),
  };
}
