import { createHash, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { HmacAddressPseudonymizer } from './hmac-address-pseudonymizer.adapter.js';

/**
 * Constant SECRET
 *
 * @description
 * A secret of the size of the private part of an Ed25519 key, generated for the run.
 *
 * @type {Buffer}
 */
const SECRET: Buffer = randomBytes(32);

describe('HmacAddressPseudonymizer', () => {
  const pseudonymizer: HmacAddressPseudonymizer = new HmacAddressPseudonymizer(SECRET);

  it('gives 22 base64url characters that hold neither the address nor its plain hash', () => {
    const pseudonym: string = pseudonymizer.pseudonymize('203.0.113.7');

    expect(pseudonym).toMatch(/^[\w-]{22}$/u);
    expect(pseudonym).not.toContain('203');
    expect(createHash('sha256').update('203.0.113.7').digest('base64url')).not.toContain(pseudonym);
  });

  it('gives the same pseudonym on every instance that holds the same secret, another without it', () => {
    const again: HmacAddressPseudonymizer = new HmacAddressPseudonymizer(Buffer.from(SECRET));
    const other: HmacAddressPseudonymizer = new HmacAddressPseudonymizer(randomBytes(32));

    expect(again.pseudonymize('203.0.113.7')).toBe(pseudonymizer.pseudonymize('203.0.113.7'));
    expect(other.pseudonymize('203.0.113.7')).not.toBe(pseudonymizer.pseudonymize('203.0.113.7'));
  });

  it('keeps two IPv4 addresses apart', () => {
    expect(pseudonymizer.pseudonymize('203.0.113.7')).not.toBe(
      pseudonymizer.pseudonymize('203.0.113.8'),
    );
  });

  it('gives an IPv4 address mapped into IPv6 the pseudonym of the IPv4 address, in either notation', () => {
    const ipv4: string = pseudonymizer.pseudonymize('203.0.113.7');

    expect(pseudonymizer.pseudonymize('::ffff:203.0.113.7')).toBe(ipv4);
    expect(pseudonymizer.pseudonymize('::FFFF:cb00:7107')).toBe(ipv4);
    expect(pseudonymizer.pseudonymize('0:0:0:0:0:ffff:203.0.113.7')).toBe(ipv4);
  });

  it('gives a 6to4 address the pseudonym of the IPv4 address its /48 comes from', () => {
    const ipv4: string = pseudonymizer.pseudonymize('203.0.113.7');

    expect(pseudonymizer.pseudonymize('2002:cb00:7107::1')).toBe(ipv4);
    expect(pseudonymizer.pseudonymize('2002:cb00:7107:ffff:1::')).toBe(ipv4);
    expect(pseudonymizer.pseudonymize('2002:cb00:7108::1')).not.toBe(ipv4);
  });

  it('gives every IPv6 address of one /64 the same pseudonym, whatever its notation', () => {
    const network: string = pseudonymizer.pseudonymize('2001:db8:85a3:7::1');

    expect(pseudonymizer.pseudonymize('2001:0db8:85a3:0007:ffff:ffff:ffff:ffff')).toBe(network);
    expect(pseudonymizer.pseudonymize('2001:DB8:85A3:7:1234::')).toBe(network);
    expect(pseudonymizer.pseudonymize('2001:db8:85a3:7::1%eth0')).toBe(network);
    expect(pseudonymizer.pseudonymize('2001:db8:85a3:7:0:0:1.2.3.4')).toBe(network);
  });

  it('keeps two /64 networks apart, and an IPv6 network apart from an IPv4 address', () => {
    expect(pseudonymizer.pseudonymize('2001:db8:85a3:7::1')).not.toBe(
      pseudonymizer.pseudonymize('2001:db8:85a3:8::1'),
    );
    expect(pseudonymizer.pseudonymize('::1')).not.toBe(pseudonymizer.pseudonymize('0.0.0.1'));
  });

  it('pseudonymizes a text that is no address as it is', () => {
    expect(pseudonymizer.pseudonymize('unknown')).toMatch(/^[\w-]{22}$/u);
    expect(pseudonymizer.pseudonymize('unknown')).not.toBe(pseudonymizer.pseudonymize('other'));
  });

  it('refuses a secret shorter than 256 bits', () => {
    expect(() => new HmacAddressPseudonymizer(randomBytes(31))).toThrow(
      'The pseudonym secret needs at least 32 bytes.',
    );
  });
});
