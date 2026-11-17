import { describe, expect, it, vi } from 'vitest';

import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import { CountRequest } from './count-request.use-case.js';

describe('CountRequest', () => {
  it('counts the request on the kind and the id of the credential', async () => {
    const consume = vi.fn<RequestCounter['consume']>(() =>
      Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
    );
    const useCase: CountRequest = new CountRequest({ consume });

    await useCase.execute({ credentialKind: 'api-token', credentialId: 'token-id' });
    await useCase.execute({ credentialKind: 'session', credentialId: 'token-id' });

    expect(consume.mock.calls).toEqual([['api-token:token-id'], ['session:token-id']]);
  });

  it('answers what the counter answers', async () => {
    const useCase: CountRequest = new CountRequest({
      consume: () => Promise.resolve({ allowed: false, retryAfterSeconds: 12 }),
    });

    await expect(
      useCase.execute({ credentialKind: 'session', credentialId: 'session-id' }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 12 });
  });
});
