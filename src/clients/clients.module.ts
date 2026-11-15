import { CONFIG, InternalHttpClient, InternalTokenSigner } from '@cadenway/nest-common';
import { Global, Module } from '@nestjs/common';

import { SESSION_INTROSPECTOR } from '../auth/session-introspector.port.js';
import type { AppConfig } from '../config/app-config.js';
import { IDENTITY_AUTH } from '../routes/auth/identity-auth.port.js';
import { IDENTITY_USERS } from '../routes/me/identity-users.port.js';
import { IDENTITY_SERVICE, IdentityServiceClient } from './identity-service.client.js';

/**
 * Class ClientsModule
 *
 * @description
 * Builds the clients of the internal services, one `InternalHttpClient` of `@cadenway/nest-common`
 * per called service (its own deadline, retry and circuit breaker), and binds them to the ports of
 * the guards and routes that use them. Global, so that a guard or a controller injects its port
 * without importing this module, and a test provides the same tokens with a fake instead.
 *
 * | Token                  | Port                  | Bound to                |
 * | ---------------------- | --------------------- | ----------------------- |
 * | `SESSION_INTROSPECTOR` | `SessionIntrospector` | `IdentityServiceClient` |
 * | `IDENTITY_AUTH`        | `IdentityAuth`        | `IdentityServiceClient` |
 * | `IDENTITY_USERS`       | `IdentityUsers`       | `IdentityServiceClient` |
 *
 * The base URL comes from `IDENTITY_SERVICE_URL`; the internal tokens are signed by the
 * `InternalTokenSigner` that `createApplication` provides from `INTERNAL_TOKEN_ISSUER` and
 * `INTERNAL_TOKEN_PRIVATE_JWK`.
 */
@Global()
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
    { provide: SESSION_INTROSPECTOR, useExisting: IdentityServiceClient },
    { provide: IDENTITY_AUTH, useExisting: IdentityServiceClient },
    { provide: IDENTITY_USERS, useExisting: IdentityServiceClient },
  ],
  exports: [SESSION_INTROSPECTOR, IDENTITY_AUTH, IDENTITY_USERS],
})
export class ClientsModule {}
