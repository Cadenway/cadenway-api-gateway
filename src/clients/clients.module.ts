import { CONFIG, InternalHttpClient, InternalTokenSigner } from '@cadenway/nest-common';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../config/app-config.js';
import { IDENTITY_SERVICE, IdentityServiceClient } from './identity-service.client.js';

/**
 * Class ClientsModule
 *
 * @description
 * Builds and exports shared technical clients for the internal services.
 */
@Module({
  providers: [
    {
      provide: IdentityServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): IdentityServiceClient =>
        new IdentityServiceClient(
          new InternalHttpClient({
            service: IDENTITY_SERVICE,
            baseUrl: config.IDENTITY_SERVICE_URL,
            signer,
          }),
        ),
    },
  ],
  exports: [IdentityServiceClient],
})
export class ClientsModule {}
