/**
 * Constant BEARER_FAILURE_COUNTER
 *
 * @description
 * Injection token of the `RequestCounter` port bound to the quota of the failed bearer-token
 * authentications, per client address.
 *
 * @type {unique symbol}
 */
export const BEARER_FAILURE_COUNTER: unique symbol = Symbol('BearerFailureCounter');
