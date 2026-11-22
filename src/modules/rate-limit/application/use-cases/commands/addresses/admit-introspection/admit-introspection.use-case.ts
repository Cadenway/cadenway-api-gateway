import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AdmitIntrospectionOutput } from './admit-introspection.output.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

const MAX_CONCURRENT = 128;
const MAX_CONCURRENT_PER_NETWORK = 32;

/** Bounds authentication work across instances by network and in each process by concurrency. */
export class AdmitIntrospection {
  // #region Properties
  /** Requests admitted in this process, including those waiting for the shared counter. */
  private active = 0;

  /** Reservations per address pseudonym, removed at the end of the last request. */
  private readonly networks = new Map<string, number>();
  // #endregion

  // #region Constructor
  /** Receives the distributed fixed-window counter and address pseudonymizer. */
  public constructor(
    private readonly counter: RequestCounter,
    private readonly pseudonymizer: AddressPseudonymizer,
  ) {}
  // #endregion

  // #region Methods
  /** Acquires capacity before accessing Identity. Excess work is refused without queuing. */
  public async execute(clientAddress: string): Promise<AdmitIntrospectionOutput> {
    if (this.active >= MAX_CONCURRENT) {
      return { outcome: 'refused', retryAfterSeconds: 1 };
    }
    const network = this.pseudonymizer.pseudonymize(clientAddress);
    const inFlight = this.networks.get(network) ?? 0;
    if (inFlight >= MAX_CONCURRENT_PER_NETWORK) {
      return { outcome: 'refused', retryAfterSeconds: 1 };
    }

    this.active += 1;
    this.networks.set(network, inFlight + 1);
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      this.active -= 1;
      const count = this.networks.get(network) ?? 0;
      if (count <= 1) this.networks.delete(network);
      else this.networks.set(network, count - 1);
    };

    try {
      const allowance = await this.counter.consume(`introspection:${network}`);
      if (!allowance.allowed) {
        release();
        return { outcome: 'refused', retryAfterSeconds: allowance.retryAfterSeconds };
      }
      return { outcome: 'granted', release };
    } catch (error) {
      release();
      throw error;
    }
  }
  // #endregion
}
