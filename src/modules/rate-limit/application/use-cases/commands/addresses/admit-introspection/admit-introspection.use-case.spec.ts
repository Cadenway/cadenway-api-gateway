import { describe, expect, it, vi } from 'vitest';

import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AdmitIntrospectionOutput } from './admit-introspection.output.js';
import { AdmitIntrospection } from './admit-introspection.use-case.js';

function release(permit: AdmitIntrospectionOutput): void {
  if (permit.outcome !== 'granted') throw new Error('An admission was unexpectedly refused.');
  permit.release();
}

describe('AdmitIntrospection', () => {
  it('counts the address pseudonym and refuses work before Identity when the window is full', async () => {
    const consume = vi.fn<RequestCounter['consume']>().mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 8,
    });
    const gate = new AdmitIntrospection({ consume, peek: vi.fn() }, { pseudonymize: () => 'net' });

    expect(await gate.execute('192.0.2.1')).toEqual({
      outcome: 'refused',
      retryAfterSeconds: 8,
    });
    expect(consume).toHaveBeenCalledExactlyOnceWith('introspection:net');

    consume.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    release(await gate.execute('192.0.2.1'));
  });

  it('bounds concurrent admission per network even while the shared counter is pending', async () => {
    let finish: ((answer: { allowed: boolean; retryAfterSeconds: number }) => void) | undefined;
    const counter = new Promise<{ allowed: boolean; retryAfterSeconds: number }>((resolve) => {
      finish = resolve;
    });
    const consume = vi.fn<RequestCounter['consume']>().mockReturnValue(counter);
    const gate = new AdmitIntrospection(
      { consume, peek: vi.fn() },
      {
        pseudonymize: (address) => (address === '192.0.2.1' ? 'first' : 'second'),
      },
    );
    const first = Array.from({ length: 32 }, () => gate.execute('192.0.2.1'));

    expect(await gate.execute('192.0.2.1')).toEqual({ outcome: 'refused', retryAfterSeconds: 1 });
    const second = gate.execute('192.0.2.2');
    expect(consume).toHaveBeenCalledTimes(33);

    if (finish === undefined) throw new Error('The counter has no resolution callback.');
    finish({ allowed: true, retryAfterSeconds: 0 });
    release(await second);
    const permits = await Promise.all(first);
    permits.forEach(release);
    permits.forEach(release);
    release(await gate.execute('192.0.2.1'));
  });

  it('bounds the sum across networks and releases a slot after verification', async () => {
    const consume = vi.fn<RequestCounter['consume']>().mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const gate = new AdmitIntrospection(
      { consume, peek: vi.fn() },
      {
        pseudonymize: (address) => address.split('.').at(-1) ?? 'unknown',
      },
    );
    const permits = await Promise.all(
      Array.from({ length: 128 }, (_, index) => gate.execute(`192.0.2.${String(index + 1)}`)),
    );

    expect(await gate.execute('192.0.2.129')).toEqual({ outcome: 'refused', retryAfterSeconds: 1 });
    expect(consume).toHaveBeenCalledTimes(128);
    const first = permits[0];
    if (first === undefined) throw new Error('The first admission is missing.');
    release(first);
    release(await gate.execute('192.0.2.129'));
    permits.forEach(release);
  });
});
