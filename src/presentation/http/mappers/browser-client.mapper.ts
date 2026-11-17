import { signInWithPasswordInternalBodyClientUserAgentMax } from '@cadenway/contracts/validators/internal/identity-service';
import type { Request } from 'express';

import { toClientAddress } from '../../../../../../presentation/http/mappers/client-address.mapper.js';
import type { Client } from '../../../../application/models/auth/client.model.js';

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
 * Function browserClient
 *
 * @description
 * Describes the browser a session is opened for, as the internal contract asks the gateway to
 * (`client`): identity-service never reads the headers of the internal call.
 *
 * - `ipAddress` is the client address of `toClientAddress`: `request.ip`, which Express derives
 *   from `X-Forwarded-For` with `trust proxy` set to one hop, so the address Traefik saw and never
 *   one the client wrote into the header itself; an IPv4 address mapped into IPv6 is given as
 *   IPv4. The rate limit counts the requests without a credential on the same address.
 * - `userAgent` is the `User-Agent` header, `null` when the browser sent none, cut to 1024 code
 *   points.
 *
 * @param {Request} request - Incoming request.
 * @returns {Client} The `client` member of the internal request.
 * @throws {Error} When the request has no peer address, which a live connection always has.
 */
export function browserClient(request: Request): Client {
  const userAgent: string | undefined = request.get('User-Agent');
  return {
    ipAddress: toClientAddress(request),
    // JSON Schema counts code points, as `Array.from` splits a string.
    userAgent:
      userAgent === undefined
        ? null
        : Array.from(userAgent).slice(0, MAX_USER_AGENT_LENGTH).join(''),
  };
}
