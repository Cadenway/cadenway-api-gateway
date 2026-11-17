import { CONFIG, InternalHttpClient, InternalTokenSigner } from '@cadenway/nest-common';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../config/app-config.js';
import { IDENTITY_SERVICE, IdentityServiceClient } from './identity-service.client.js';
import { ORGANIZATION_SERVICE, OrganizationServiceClient } from './organization-service.client.js';

/**
 * Class ClientsModule
 *
 * @description
 * Builds and exports shared technical clients for the internal services, one `InternalHttpClient`
 * (deadline, retry, circuit breaker, internal token) per service.
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
    {
      provide: OrganizationServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): OrganizationServiceClient =>
        new OrganizationServiceClient(
          new InternalHttpClient({
            service: ORGANIZATION_SERVICE,
            baseUrl: config.ORGANIZATION_SERVICE_URL,
            signer,
          }),
        ),
    },
  ],
  exports: [IdentityServiceClient, OrganizationServiceClient],
})
export class ClientsModule {}
