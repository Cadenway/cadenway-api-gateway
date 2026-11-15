import type { Client } from '@cadenway/contracts/types/internal/identity-service';
import { signInWithPasswordInternalBodyClientUserAgentMax } from '@cadenway/contracts/validators/internal/identity-service';
import type { Request } from 'express';

/**
 * Constant MAX_USER_AGENT_LENGTH
 *
 * @description
 * Longest `User-Agent` the internal contract accepts (`Client.userAgent`), in code points. A longer
 * header is cut there rather than failing the sign-in: the value only describes the device.
 *
 * @type {number}
 */
const MAX_USER_AGENT_LENGTH: number = signInWithPasswordInternalBodyClientUserAgentMax;

/**
 * Constant IPV4_MAPPED_PREFIX
 *
 * @description
 * Prefix Node gives an IPv4 peer on a dual-stack socket (`::ffff:86.247.12.30`). It is removed so
 * that identity-service stores the address the browser has.
 *
 * @type {string}
 */
const IPV4_MAPPED_PREFIX: string = '::ffff:';

/**
 * Function browserClient
 *
 * @description
 * Describes the browser a session is opened for, as the internal contract asks the gateway to
 * (`client`): identity-service never reads the headers of the internal call.
 *
 * - `ipAddress` is `request.ip`, which Express derives from `X-Forwarded-For` with
 *   `trust proxy` set to one hop: the address Traefik saw, never one the client wrote into the
 *   header itself.
 * - `userAgent` is the `User-Agent` header, `null` when the browser sent none, cut to 1024 code
 *   points.
 *
 * @param {Request} request - Incoming request.
 * @returns {Client} The `client` member of the internal request.
 * @throws {Error} When the request has no peer address, which a live connection always has.
 */
export function browserClient(request: Request): Client {
  const address: string | undefined = request.ip ?? request.socket.remoteAddress;
  if (address === undefined) {
    throw new Error('The request has no client address.');
  }
  const userAgent: string | undefined = request.get('User-Agent');
  return {
    ipAddress:
      address.startsWith(IPV4_MAPPED_PREFIX) && address.includes('.')
        ? address.slice(IPV4_MAPPED_PREFIX.length)
        : address,
    // JSON Schema counts code points, as `Array.from` splits a string.
    userAgent:
      userAgent === undefined
        ? null
        : Array.from(userAgent).slice(0, MAX_USER_AGENT_LENGTH).join(''),
  };
}
