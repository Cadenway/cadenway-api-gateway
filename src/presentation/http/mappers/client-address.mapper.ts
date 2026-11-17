import type { Request } from 'express';

/**
 * Constant IPV4_MAPPED_PREFIX
 *
 * @description
 * Prefix Node gives an IPv4 peer on a dual-stack socket (`::ffff:86.247.12.30`). It is removed so
 * that an IPv4 client has one address, whichever socket it came through.
 *
 * @type {string}
 */
const IPV4_MAPPED_PREFIX: string = '::ffff:';

/**
 * Function toClientAddress
 *
 * @description
 * The address of the client of a request: `request.ip`, which Express derives from
 * `X-Forwarded-For` with `trust proxy` set to one hop (`TRUSTED_PROXY_HOPS`), so the address
 * Traefik saw and never one the client wrote into the header itself; the socket address without a
 * proxy. An IPv4 address mapped into IPv6 is given as IPv4. identity-service records it with the
 * sessions, and the rate limit counts the requests without a credential and the failed bearer
 * tokens on it. It is personal data: never logged at `info` level, never a key as it is.
 *
 * @param {Request} request - Incoming request.
 * @returns {string} The client address.
 * @throws {Error} When the request has no peer address, which a live connection always has.
 */
export function toClientAddress(request: Request): string {
  const address: string | undefined = request.ip ?? request.socket.remoteAddress;
  if (address === undefined) {
    throw new Error('The request has no client address.');
  }
  return address.startsWith(IPV4_MAPPED_PREFIX) && address.includes('.')
    ? address.slice(IPV4_MAPPED_PREFIX.length)
    : address;
}
