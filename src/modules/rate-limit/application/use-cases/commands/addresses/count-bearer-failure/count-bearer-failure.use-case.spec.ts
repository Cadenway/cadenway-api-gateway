import { describe, expect, it, vi } from 'vitest';

import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import { CountBearerFailure } from './count-bearer-failure.use-case.js';

describe('CountBearerFailure', () => {
  it('counts one failure on the pseudonym of the address, past the quota too', async () => {
    const consume = vi.fn<RequestCounter['consume']>(() =>
      Promise.resolve({ allowed: false, retryAfterSeconds: 3 }),
    );
    const useCase: CountBearerFailure = new CountBearerFailure(
      { consume, peek: vi.fn() },
      { pseudonymize: (address: string): string => `pseudonym-of-${address}` },
    );

    await expect(useCase.execute({ clientAddress: '203.0.113.7' })).resolves.toBeUndefined();
    expect(consume.mock.calls).toEqual([['bearer-failures:pseudonym-of-203.0.113.7']]);
  });
});
