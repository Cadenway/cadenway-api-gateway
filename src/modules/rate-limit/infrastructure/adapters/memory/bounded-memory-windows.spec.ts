import { describe, expect, it } from 'vitest';

import type { RequestAllowance } from '../../../application/models/requests/request-allowance.model.js';
import { BoundedMemoryWindows } from './bounded-memory-windows.js';

/**
 * Constant START
 *
 * @description
 * Instant of the first request of the tests, in milliseconds since the epoch.
 *
 * @type {number}
 */
const START: number = Date.parse('2026-11-08T13:07:00Z');

describe('BoundedMemoryWindows', () => {
  it('allows the quota of a key in its window, refuses beyond with the seconds left, then opens a new window', () => {
    const windows: BoundedMemoryWindows = new BoundedMemoryWindows({
      requests: 2,
      windowSeconds: 60,
      maxKeys: 10,
    });

    const allowances: RequestAllowance[] = [
      windows.consume('anonymous:a', START),
      windows.consume('anonymous:a', START + 1_000),
      windows.consume('anonymous:a', START + 20_500),
    ];
    const other: RequestAllowance = windows.consume('anonymous:b', START + 20_500);
    const next: RequestAllowance = windows.consume('anonymous:a', START + 60_000);

    expect(allowances).toEqual([
      { allowed: true, retryAfterSeconds: 0 },
      { allowed: true, retryAfterSeconds: 0 },
      { allowed: false, retryAfterSeconds: 40 },
    ]);
    expect(other).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(next).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('reads a window without counting: room while the quota is not used, the seconds left once it is', () => {
    const windows: BoundedMemoryWindows = new BoundedMemoryWindows({
      requests: 2,
      windowSeconds: 60,
      maxKeys: 10,
    });

    const fresh: RequestAllowance = windows.peek('bearer-failures:a', START);
    windows.consume('bearer-failures:a', START);
    const once: RequestAllowance = windows.peek('bearer-failures:a', START + 1_000);
    windows.consume('bearer-failures:a', START + 1_000);
    const used: RequestAllowance = windows.peek('bearer-failures:a', START + 30_000);

    expect(fresh).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(once).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(used).toEqual({ allowed: false, retryAfterSeconds: 30 });
    expect(windows.peek('bearer-failures:a', START + 60_000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('holds at most its keys: new keys share one overflow window, keys with a window keep it', () => {
    const windows: BoundedMemoryWindows = new BoundedMemoryWindows({
      requests: 2,
      windowSeconds: 60,
      maxKeys: 3,
    });
    for (const key of ['anonymous:a', 'anonymous:b', 'anonymous:c']) {
      windows.consume(key, START);
    }

    const flood: RequestAllowance[] = ['x', 'y', 'z'].map((name: string) =>
      windows.consume(`anonymous:${name}`, START + 1_000),
    );
    const held: RequestAllowance = windows.consume('anonymous:a', START + 1_000);

    expect(windows.size).toBe(4);
    expect(flood).toEqual([
      { allowed: true, retryAfterSeconds: 0 },
      { allowed: true, retryAfterSeconds: 0 },
      { allowed: false, retryAfterSeconds: 60 },
    ]);
    expect(windows.peek('anonymous:w', START + 1_000).allowed).toBe(false);
    expect(held).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it('deletes the ended windows before it overflows, without a timer per key', () => {
    const windows: BoundedMemoryWindows = new BoundedMemoryWindows({
      requests: 1,
      windowSeconds: 60,
      maxKeys: 2,
    });
    windows.consume('anonymous:a', START);
    windows.consume('anonymous:b', START + 1_000);

    const later: RequestAllowance = windows.consume('anonymous:c', START + 60_000);

    expect(later).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(windows.size).toBe(2);
    expect(windows.consume('anonymous:d', START + 61_000)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(windows.size).toBe(2);
  });
});
