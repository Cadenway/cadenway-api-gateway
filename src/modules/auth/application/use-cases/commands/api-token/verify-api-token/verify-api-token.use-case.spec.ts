import { describe, expect, it, vi } from 'vitest';

import type { VerifiedApiToken } from '../../../../models/api-token/verified-api-token.model.js';
import type { ApiTokenIntrospector } from '../../../../ports/outbound/identity/api-token/api-token-introspector.port.js';
import type { BearerFailureLimit } from '../../../../ports/outbound/rate-limit/api-token/bearer-failure-limit.port.js';
import { VerifyApiToken } from './verify-api-token.use-case.js';

/**
 * Constant TOKEN
 *
 * @description
 * An active personal API token, as the introspection returns it.
 *
 * @type {VerifiedApiToken}
 */
const TOKEN: VerifiedApiToken = {
  apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e90',
  userId: '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c30',
  organizationId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f',
  role: 'owner',
  scopes: ['members:read'],
  expiresAt: null,
};

/**
 * Constant ADDRESS
 *
 * @description
 * The client address of the requests.
 *
 * @type {string}
 */
const ADDRESS: string = '203.0.113.7';

/**
 * Function useCaseWith
 *
 * @description
 * The use case over mocks of its ports.
 *
 * @param {VerifiedApiToken | null} introspected - What the introspection answers.
 * @param {number} secondsUntilAllowed - What the failure limit answers.
 * @returns {{ useCase: VerifyApiToken; introspect: ReturnType<typeof vi.fn>; countFailure: ReturnType<typeof vi.fn> }} The use case and the mocks.
 */
function useCaseWith(
  introspected: VerifiedApiToken | null,
  secondsUntilAllowed: number = 0,
): {
  useCase: VerifyApiToken;
  introspect: ReturnType<typeof vi.fn<ApiTokenIntrospector['introspect']>>;
  countFailure: ReturnType<typeof vi.fn<BearerFailureLimit['countFailure']>>;
} {
  const introspect = vi.fn<ApiTokenIntrospector['introspect']>(() => Promise.resolve(introspected));
  const countFailure = vi.fn<BearerFailureLimit['countFailure']>(() => Promise.resolve());
  const useCase: VerifyApiToken = new VerifyApiToken(
    { introspect },
    { secondsUntilAllowed: () => Promise.resolve(secondsUntilAllowed), countFailure },
  );
  return { useCase, introspect, countFailure };
}

describe('VerifyApiToken', () => {
  it('verifies an active token and counts no failure', async () => {
    const { useCase, introspect, countFailure } = useCaseWith(TOKEN);

    await expect(
      useCase.execute({ token: 'cw_pat_token', clientAddress: ADDRESS }),
    ).resolves.toEqual({ outcome: 'verified', token: TOKEN });
    expect(introspect).toHaveBeenCalledWith('cw_pat_token');
    expect(countFailure).not.toHaveBeenCalled();
  });

  it('counts a token the introspection does not find active as a failure of the address', async () => {
    const { useCase, countFailure } = useCaseWith(null);

    await expect(
      useCase.execute({ token: 'cw_pat_token', clientAddress: ADDRESS }),
    ).resolves.toEqual({ outcome: 'invalid' });
    expect(countFailure).toHaveBeenCalledWith(ADDRESS);
  });

  it('counts a malformed token as a failure without introspecting it', async () => {
    const { useCase, introspect, countFailure } = useCaseWith(TOKEN);

    await expect(useCase.execute({ token: null, clientAddress: ADDRESS })).resolves.toEqual({
      outcome: 'invalid',
    });
    expect(introspect).not.toHaveBeenCalled();
    expect(countFailure).toHaveBeenCalledWith(ADDRESS);
  });

  it('throttles an address that used its failures before introspecting any token, a valid one too', async () => {
    const { useCase, introspect, countFailure } = useCaseWith(TOKEN, 23);

    await expect(
      useCase.execute({ token: 'cw_pat_token', clientAddress: ADDRESS }),
    ).resolves.toEqual({ outcome: 'throttled', retryAfterSeconds: 23 });
    expect(introspect).not.toHaveBeenCalled();
    expect(countFailure).not.toHaveBeenCalled();
  });

  it('counts no failure when the introspection itself fails', async () => {
    const { useCase, introspect, countFailure } = useCaseWith(TOKEN);
    introspect.mockRejectedValue(new Error('identity-service is unavailable'));

    await expect(
      useCase.execute({ token: 'cw_pat_token', clientAddress: ADDRESS }),
    ).rejects.toThrow('identity-service is unavailable');
    expect(countFailure).not.toHaveBeenCalled();
  });
});
