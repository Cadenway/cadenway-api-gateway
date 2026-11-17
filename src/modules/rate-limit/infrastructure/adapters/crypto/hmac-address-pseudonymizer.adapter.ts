import { createHmac, createSecretKey, hkdfSync, type KeyObject } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';

import type { AddressPseudonymizer } from '../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/**
 * Constant KEY_SALT
 *
 * @description
 * HKDF salt of the pseudonym key. Fixed and public: the secret is the input key material.
 *
 * @type {string}
 */
const KEY_SALT: string = 'cadenway-api-gateway/rate-limit';

/**
 * Constant KEY_INFO
 *
 * @description
 * HKDF context of the pseudonym key. It separates this key from any other use of the same secret,
 * so neither the key nor a pseudonym tells anything about the secret it comes from. Changing it
 * changes every pseudonym, which only restarts the windows in progress.
 *
 * @type {string}
 */
const KEY_INFO: string = 'client-address-pseudonym/v1';

/**
 * Constant KEY_BYTES
 *
 * @description
 * Length of the derived HMAC-SHA-256 key, in bytes.
 *
 * @type {number}
 */
const KEY_BYTES: number = 32;

/**
 * Constant MIN_SECRET_BYTES
 *
 * @description
 * Shortest secret the key may be derived from, in bytes: 256 bits, as many as the key.
 *
 * @type {number}
 */
const MIN_SECRET_BYTES: number = 32;

/**
 * Constant PSEUDONYM_BYTES
 *
 * @description
 * Bytes of the HMAC kept in a pseudonym: 128 bits, written as 22 base64url characters. Two
 * networks share a pseudonym, and so a counter, with a negligible probability.
 *
 * @type {number}
 */
const PSEUDONYM_BYTES: number = 16;

/**
 * Constant SIX_TO_FOUR_PREFIX
 *
 * @description
 * First group of a 6to4 address (`2002::/16`, RFC 3056), whose next two groups are the IPv4
 * address of the host that owns its `/48`.
 *
 * @type {number}
 */
const SIX_TO_FOUR_PREFIX: number = 0x2002;

/**
 * Constant EMBEDDED_IPV4
 *
 * @description
 * An IPv4 address written in the last 32 bits of an IPv6 address (`::ffff:203.0.113.7`).
 *
 * @type {RegExp}
 */
const EMBEDDED_IPV4: RegExp = /^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/u;

/**
 * Function hexGroups
 *
 * @description
 * Parses the groups of one side of `::` in an IPv6 address.
 *
 * @param {string} side - Colon-separated hexadecimal groups, possibly empty.
 * @returns {number[]} The groups.
 */
function hexGroups(side: string): number[] {
  return side === '' ? [] : side.split(':').map((group: string) => Number.parseInt(group, 16));
}

/**
 * Function hexGroupOf
 *
 * @description
 * Writes two octets of an IPv4 address as one hexadecimal IPv6 group.
 *
 * @param {string | undefined} high - The first octet, in decimal.
 * @param {string | undefined} low - The second octet, in decimal.
 * @returns {string} The group.
 */
function hexGroupOf(high: string | undefined, low: string | undefined): string {
  return ((Number(high) << 8) | Number(low)).toString(16);
}

/**
 * Function ipv6Groups
 *
 * @description
 * Expands a valid IPv6 address, without a zone, into its eight 16-bit groups: `::` stands for as
 * many zero groups as missing, and an embedded IPv4 address for the last two groups.
 *
 * @param {string} address - An address `isIPv6` accepts.
 * @returns {number[]} The eight groups.
 */
function ipv6Groups(address: string): number[] {
  const embedded: RegExpExecArray | null = EMBEDDED_IPV4.exec(address);
  const text: string =
    embedded === null
      ? address
      : [
          `${embedded[1] ?? ''}${hexGroupOf(embedded[2], embedded[3])}`,
          hexGroupOf(embedded[4], embedded[5]),
        ].join(':');
  const gap: number = text.indexOf('::');
  if (gap < 0) {
    return hexGroups(text);
  }
  const head: number[] = hexGroups(text.slice(0, gap));
  const tail: number[] = hexGroups(text.slice(gap + 2));
  return [...head, ...Array.from({ length: 8 - head.length - tail.length }, () => 0), ...tail];
}

/**
 * Function clientNetworkOf
 *
 * @description
 * The network a client address is limited as: the IPv4 address itself, or the `/64` prefix of an
 * IPv6 address, the block one subscriber holds whole and could otherwise rotate through. An IPv4
 * address mapped into IPv6 (`::ffff:203.0.113.7`, as a dual-stack socket reports it) is the IPv4
 * address, and so is a 6to4 address (`2002:cb00:7107::/48`), whose whole `/48` any host of that
 * IPv4 address may use. A zone (`%eth0`) is dropped. Any other text, which Express never derives
 * from a socket, is kept as it is.
 *
 * @param {string} address - The client address.
 * @returns {string} The canonical network, the input of the pseudonym.
 */
function clientNetworkOf(address: string): string {
  const unzoned: string = address.split('%')[0] ?? address;
  if (isIPv4(unzoned)) {
    return unzoned;
  }
  if (!isIPv6(unzoned)) {
    return address;
  }
  const groups: number[] = ipv6Groups(unzoned);
  const mapped: boolean =
    groups.slice(0, 5).every((group: number) => group === 0) && groups[5] === 0xffff;
  if (mapped || groups[0] === SIX_TO_FOUR_PREFIX) {
    const high: number = (mapped ? groups[6] : groups[1]) ?? 0;
    const low: number = (mapped ? groups[7] : groups[2]) ?? 0;
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
  }
  return `${groups
    .slice(0, 4)
    .map((group: number) => group.toString(16))
    .join(':')}::/64`;
}

/**
 * Class HmacAddressPseudonymizer
 *
 * @description
 * Pseudonymizes client addresses with HMAC-SHA-256 under a key derived by HKDF-SHA-256 from a
 * server-side secret, so that Redis holds no address. A plain hash would not do: the 2^32 IPv4
 * addresses can be hashed in minutes, so anyone reading Redis would read the addresses back. With
 * the key, which never leaves the process, nobody can; every instance derives the same key from
 * the same secret, so the counters stay shared. Each pseudonym is the first 128 bits of the HMAC
 * of the network of the address, in base64url.
 */
export class HmacAddressPseudonymizer implements AddressPseudonymizer {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * The HMAC key, derived from the secret once: a key object, so that no request imports it
   * again. Never logged.
   *
   * @type {KeyObject}
   * @readonly
   */
  private readonly key: KeyObject;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Derives the HMAC key from the secret.
   *
   * @param {Uint8Array} secret - Server-side secret, at least 32 bytes, the same on every instance.
   * @constructor
   * @throws {Error} When the secret is shorter than 32 bytes: a configuration error.
   */
  public constructor(secret: Uint8Array) {
    if (secret.byteLength < MIN_SECRET_BYTES) {
      throw new Error(`The pseudonym secret needs at least ${String(MIN_SECRET_BYTES)} bytes.`);
    }
    this.key = createSecretKey(
      Buffer.from(hkdfSync('sha256', secret, KEY_SALT, KEY_INFO, KEY_BYTES)),
    );
  }
  // #endregion

  // #region Methods
  /**
   * Method pseudonymize
   *
   * @description
   * Computes the pseudonym of the network of a client address.
   *
   * @param {string} clientAddress - The client address.
   * @returns {string} 22 base64url characters.
   */
  public pseudonymize(clientAddress: string): string {
    return createHmac('sha256', this.key)
      .update(clientNetworkOf(clientAddress))
      .digest()
      .subarray(0, PSEUDONYM_BYTES)
      .toString('base64url');
  }
  // #endregion
}
