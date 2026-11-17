/**
 * Constant ANONYMOUS_REQUEST_COUNTER
 *
 * @description
 * Injection token of the `RequestCounter` port bound to the quota of the requests without a
 * credential, per client address.
 *
 * @type {unique symbol}
 */
export const ANONYMOUS_REQUEST_COUNTER: unique symbol = Symbol('AnonymousRequestCounter');
