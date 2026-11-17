/**
 * Interface AddressPseudonymizer
 *
 * @description
 * Outgoing port of the per-address limits: turns a client address into the pseudonym its counters
 * are keyed by, so that Redis never holds an address. The pseudonym is a keyed hash: the same for
 * every request of one client network on every instance of the gateway, and not reversible
 * without the server-side key, which never leaves the process.
 */
export interface AddressPseudonymizer {
  // #region Methods
  /**
   * Method pseudonymize
   *
   * @description
   * Computes the pseudonym of the network of a client address: the IPv4 address itself, or the
   * `/64` prefix of an IPv6 address, which one subscriber holds whole. An IPv4 address mapped into
   * IPv6 (`::ffff:203.0.113.7`) is the IPv4 address.
   *
   * @param {string} clientAddress - The address Traefik saw, as Express reads it.
   * @returns {string} The pseudonym, safe to use in a key.
   */
  pseudonymize(clientAddress: string): string;
  // #endregion
}
