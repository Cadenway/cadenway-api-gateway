import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import type { SiteOperation } from '../../../../models/requests/site-operation.model.js';

/** Fixed public-site form quotas per client network and operation. */
export const SITE_REQUEST_QUOTAS = { contact: 5, newsletter: 10 } as const;

/** Counts public site forms without retaining visitor addresses or submitted content. */
export class CountSiteRequest {
  // #region Constructor
  /** Uses independent counters and the gateway's keyed address pseudonymizer. */
  public constructor(
    private readonly counters: Readonly<Record<SiteOperation, RequestCounter>>,
    private readonly pseudonymizer: AddressPseudonymizer,
  ) {}
  // #endregion

  // #region Methods
  /** Counts a request before body validation and upstream submission. */
  public execute(address: string, operation: SiteOperation): Promise<RequestAllowance> {
    return this.counters[operation].consume(
      `site-${operation}:${this.pseudonymizer.pseudonymize(address)}`,
    );
  }
  // #endregion
}
