import { describe, expect, it, vi } from 'vitest';

import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import { CheckBearerFailures } from './check-bearer-failures.use-case.js';

describe('CheckBearerFailures', () => {
  it('reads the failures of the pseudonym of the address without counting one', async () => {
    const consume = vi.fn<RequestCounter['consume']>();
    const peek = vi.fn<RequestCounter['peek']>(() =>
      Promise.resolve({ allowed: false, retryAfterSeconds: 14 }),
    );
    const useCase: CheckBearerFailures = new CheckBearerFailures(
      { consume, peek },
      { pseudonymize: (address: string): string => `pseudonym-of-${address}` },
    );

    await expect(useCase.execute({ clientAddress: '2001:db8::7' })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 14,
    });
    expect(peek.mock.calls).toEqual([['bearer-failures:pseudonym-of-2001:db8::7']]);
    expect(consume).not.toHaveBeenCalled();
  });
});
