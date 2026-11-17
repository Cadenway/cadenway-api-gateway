import type { RequestAllowance } from '../../../application/models/requests/request-allowance.model.js';

/**
 * Interface MemoryWindowLimits
 *
 * @description
 * The quota of a `BoundedMemoryWindows` and the number of keys it may hold.
 */
export interface MemoryWindowLimits {
  // #region Properties
  /**
   * Property requests
   *
   * @description
   * Requests a key may make in one window.
   *
   * @type {number}
   * @readonly
   */
  readonly requests: number;

  /**
   * Property windowSeconds
   *
   * @description
   * Length of a window, in seconds; it starts with the first request of the key.
   *
   * @type {number}
   * @readonly
   */
  readonly windowSeconds: number;

  /**
   * Property maxKeys
   *
   * @description
   * Most keys held at once. Past it, the requests of a key without a window share one overflow
   * window, so a flood of new keys costs no more memory.
   *
   * @type {number}
   * @readonly
   */
  readonly maxKeys: number;
  // #endregion
}

/**
 * Interface MemoryWindow
 *
 * @description
 * The window of one key.
 */
interface MemoryWindow {
  // #region Properties
  /**
   * Property consumed
   *
   * @description
   * Requests counted in the window, refused ones included.
   *
   * @type {number}
   */
  consumed: number;

  /**
   * Property resetAt
   *
   * @description
   * Instant the window ends, in milliseconds since the epoch.
   *
   * @type {number}
   * @readonly
   */
  readonly resetAt: number;
  // #endregion
}

/**
 * Constant OVERFLOW_KEY
 *
 * @description
 * Key of the window the requests of new keys share once the table is full. A counter key always
 * starts with its kind and a colon, so it is never this one.
 *
 * @type {string}
 */
const OVERFLOW_KEY: string = 'overflow';

/**
 * Constant ALLOWED
 *
 * @description
 * The allowance of a request within its quota.
 *
 * @type {RequestAllowance}
 */
const ALLOWED: RequestAllowance = Object.freeze({ allowed: true, retryAfterSeconds: 0 });

/**
 * Class BoundedMemoryWindows
 *
 * @description
 * Fixed-window request counters in the memory of one instance, with a bounded number of keys: the
 * fallback of the Redis counters while Redis cannot count. Every window lasts as long, and an
 * expired one is deleted before its key gets another, so the table keeps its windows in the order
 * they end: creating a window first deletes the ended ones at its head, without a timer per key.
 * Once `maxKeys` windows are live, a key without one is counted on a shared overflow window with
 * the same quota: the clients a flood of new keys competes with are limited together rather than
 * the memory growing, and those that already hold a window keep it.
 */
export class BoundedMemoryWindows {
  // #region Properties
  /**
   * Property limits
   *
   * @description
   * The quota and the most keys held.
   *
   * @type {MemoryWindowLimits}
   * @readonly
   */
  private readonly limits: MemoryWindowLimits;

  /**
   * Property windows
   *
   * @description
   * The live windows, in the order they end.
   *
   * @type {Map<string, MemoryWindow>}
   * @readonly
   */
  private readonly windows: Map<string, MemoryWindow>;

  /**
   * Property size
   *
   * @description
   * Windows held, ended ones not yet deleted included; at most `maxKeys` plus the overflow one.
   *
   * @type {number}
   */
  public get size(): number {
    return this.windows.size;
  }
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Creates an empty table.
   *
   * @param {MemoryWindowLimits} limits - The quota and the most keys held.
   * @constructor
   */
  public constructor(limits: MemoryWindowLimits) {
    this.limits = limits;
    this.windows = new Map<string, MemoryWindow>();
  }
  // #endregion

  // #region Methods
  /**
   * Method consume
   *
   * @description
   * Counts one request of a key, on its window or, when the table is full, on the overflow one.
   *
   * @param {string} key - Key of the counter.
   * @param {number} now - Current instant, in milliseconds since the epoch.
   * @returns {RequestAllowance} Whether the request fits in the quota, and when to retry.
   */
  public consume(key: string, now: number): RequestAllowance {
    const slot: string = this.slotOf(key, now);
    let window: MemoryWindow | undefined = this.liveWindow(slot, now);
    if (window === undefined) {
      window = { consumed: 0, resetAt: now + this.limits.windowSeconds * 1000 };
      this.windows.set(slot, window);
    }
    window.consumed += 1;
    return window.consumed <= this.limits.requests ? ALLOWED : this.refusalOf(window, now);
  }

  /**
   * Method peek
   *
   * @description
   * Tells whether one more request of a key would fit, reading the window `consume` would count
   * it on, without counting it.
   *
   * @param {string} key - Key of the counter.
   * @param {number} now - Current instant, in milliseconds since the epoch.
   * @returns {RequestAllowance} Whether the quota leaves room, and when to retry.
   */
  public peek(key: string, now: number): RequestAllowance {
    const window: MemoryWindow | undefined =
      this.liveWindow(key, now) ??
      (this.windows.size >= this.limits.maxKeys ? this.liveWindow(OVERFLOW_KEY, now) : undefined);
    return window === undefined || window.consumed < this.limits.requests
      ? ALLOWED
      : this.refusalOf(window, now);
  }

  /**
   * Method slotOf
   *
   * @description
   * The key a request is counted on: its own while it has a live window or the table has room,
   * after the ended windows are deleted; the overflow key otherwise.
   *
   * @param {string} key - Key of the counter.
   * @param {number} now - Current instant.
   * @returns {string} The key to count on.
   */
  private slotOf(key: string, now: number): string {
    if (this.liveWindow(key, now) !== undefined) {
      return key;
    }
    for (const [held, window] of this.windows) {
      if (window.resetAt > now) {
        break;
      }
      this.windows.delete(held);
    }
    return this.windows.size >= this.limits.maxKeys ? OVERFLOW_KEY : key;
  }

  /**
   * Method liveWindow
   *
   * @description
   * The window of a key, deleted and forgotten once it has ended.
   *
   * @param {string} key - Key of the counter.
   * @param {number} now - Current instant.
   * @returns {MemoryWindow | undefined} The live window, if any.
   */
  private liveWindow(key: string, now: number): MemoryWindow | undefined {
    const window: MemoryWindow | undefined = this.windows.get(key);
    if (window !== undefined && window.resetAt <= now) {
      this.windows.delete(key);
      return undefined;
    }
    return window;
  }

  /**
   * Method refusalOf
   *
   * @description
   * The refusal of a request on a window whose quota is used.
   *
   * @param {MemoryWindow} window - The window.
   * @param {number} now - Current instant.
   * @returns {RequestAllowance} Refused, with the whole seconds, at least 1, until the window ends.
   */
  private refusalOf(window: MemoryWindow, now: number): RequestAllowance {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }
  // #endregion
}
