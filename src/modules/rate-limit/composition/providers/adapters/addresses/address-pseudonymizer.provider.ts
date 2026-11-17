import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';

import type { AppConfig } from '../../../../../../config/app-config.js';
import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';
import { HmacAddressPseudonymizer } from '../../../../infrastructure/adapters/crypto/hmac-address-pseudonymizer.adapter.js';

/**
 * Constant addressPseudonymizerProvider
 *
 * @description
 * Binds the address pseudonymizer to an HMAC key derived from the private part (`d`) of
 * `INTERNAL_TOKEN_PRIVATE_JWK`: a 256-bit server-side secret every instance of the gateway already
 * holds, the same within an environment, that never leaves the process. HKDF separates the derived
 * key from the signing key, so no new secret has to be distributed. Rotating the signing key
 * changes every pseudonym, which only restarts the windows in progress.
 *
 * @type {FactoryProvider<AddressPseudonymizer>}
 */
export const addressPseudonymizerProvider: FactoryProvider<AddressPseudonymizer> = {
  provide: ADDRESS_PSEUDONYMIZER,
  inject: [CONFIG],
  useFactory: (config: Pick<AppConfig, 'INTERNAL_TOKEN_PRIVATE_JWK'>): AddressPseudonymizer =>
    new HmacAddressPseudonymizer(Buffer.from(config.INTERNAL_TOKEN_PRIVATE_JWK.d, 'base64url')),
};
