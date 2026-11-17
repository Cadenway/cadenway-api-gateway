import { describe, expect, it, vi } from 'vitest';

import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import { CountAnonymousRequest } from './count-anonymous-request.use-case.js';

/**
 * Constant PSEUDONYMIZER
 *
 * @description
 * A pseudonymizer that hides the address behind a marked name.
 *
 * @type {AddressPseudonymizer}
 */
const PSEUDONYMIZER: AddressPseudonymizer = {
  pseudonymize: (address: string): string => `pseudonym-of-${address}`,
};

describe('CountAnonymousRequest', () => {
  it('counts the request on the pseudonym of its client address, apart from the credentials', async () => {
    const consume = vi.fn<RequestCounter['consume']>(() =>
      Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
    );
    const useCase: CountAnonymousRequest = new CountAnonymousRequest(
      { consume, peek: vi.fn() },
      PSEUDONYMIZER,
    );

    await useCase.execute({ clientAddress: '203.0.113.7' });

    expect(consume.mock.calls).toEqual([['anonymous:pseudonym-of-203.0.113.7']]);
  });

  it('answers what the counter answers', async () => {
    const useCase: CountAnonymousRequest = new CountAnonymousRequest(
      { consume: () => Promise.resolve({ allowed: false, retryAfterSeconds: 9 }), peek: vi.fn() },
      PSEUDONYMIZER,
    );

    await expect(useCase.execute({ clientAddress: '203.0.113.7' })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 9,
    });
  });
});
