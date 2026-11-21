import { CONFIG, InternalHttpClient, InternalTokenSigner } from '@cadenway/nest-common';
import { Module } from '@nestjs/common';

import type { AppConfig } from '../config/app-config.js';
import { AUTOMATION_SERVICE, AutomationServiceClient } from './automation-service.client.js';
import { BILLING_SERVICE, BillingServiceClient } from './billing-service.client.js';
import { DOCUMENT_SERVICE, DocumentServiceClient } from './document-service.client.js';
import { IDENTITY_SERVICE, IdentityServiceClient } from './identity-service.client.js';
import { INTEGRATION_SERVICE, IntegrationServiceClient } from './integration-service.client.js';
import { ORGANIZATION_SERVICE, OrganizationServiceClient } from './organization-service.client.js';
import { SEARCH_SERVICE, SearchServiceClient } from './search-service.client.js';
import { STORAGE_SERVICE, StorageServiceClient } from './storage-service.client.js';
import { NOTIFICATION_SERVICE, NotificationServiceClient } from './notification-service.client.js';
import { TASK_SERVICE, TaskServiceClient } from './task-service.client.js';

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
      provide: AutomationServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): AutomationServiceClient =>
        new AutomationServiceClient(
          new InternalHttpClient({
            service: AUTOMATION_SERVICE,
            baseUrl: config.AUTOMATION_SERVICE_URL,
            signer,
          }),
        ),
    },
    {
      provide: IntegrationServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): IntegrationServiceClient =>
        new IntegrationServiceClient(
          new InternalHttpClient({
            service: INTEGRATION_SERVICE,
            baseUrl: config.INTEGRATION_SERVICE_URL,
            signer,
            allowedUnavailableProblemCodes: ['integration.unavailable'],
          }),
        ),
    },
    {
      provide: BillingServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): BillingServiceClient =>
        new BillingServiceClient(
          new InternalHttpClient({
            service: BILLING_SERVICE,
            baseUrl: config.BILLING_SERVICE_URL,
            signer,
            allowedUnavailableProblemCodes: ['billing.unavailable'],
          }),
        ),
    },
    {
      provide: SearchServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): SearchServiceClient =>
        new SearchServiceClient(
          new InternalHttpClient({
            service: SEARCH_SERVICE,
            baseUrl: config.SEARCH_SERVICE_URL,
            signer,
            allowedUnavailableProblemCodes: ['search.unavailable'],
          }),
        ),
    },
    {
      provide: DocumentServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): DocumentServiceClient =>
        new DocumentServiceClient(
          new InternalHttpClient({
            service: DOCUMENT_SERVICE,
            baseUrl: config.DOCUMENT_SERVICE_URL,
            signer,
            allowedUnavailableProblemCodes: ['document.unavailable'],
          }),
        ),
    },
    {
      provide: StorageServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): StorageServiceClient =>
        new StorageServiceClient(
          new InternalHttpClient({
            service: STORAGE_SERVICE,
            baseUrl: config.STORAGE_SERVICE_URL,
            signer,
            allowedUnavailableProblemCodes: ['storage.unavailable'],
          }),
        ),
    },
    {
      provide: NotificationServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): NotificationServiceClient =>
        new NotificationServiceClient(
          new InternalHttpClient({
            service: NOTIFICATION_SERVICE,
            baseUrl: config.NOTIFICATION_SERVICE_URL,
            signer,
          }),
        ),
    },
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
    {
      provide: TaskServiceClient,
      inject: [CONFIG, InternalTokenSigner],
      useFactory: (config: AppConfig, signer: InternalTokenSigner): TaskServiceClient =>
        new TaskServiceClient(
          new InternalHttpClient({
            service: TASK_SERVICE,
            baseUrl: config.TASK_SERVICE_URL,
            signer,
          }),
        ),
    },
  ],
  exports: [
    AutomationServiceClient,
    IntegrationServiceClient,
    BillingServiceClient,
    DocumentServiceClient,
    IdentityServiceClient,
    OrganizationServiceClient,
    SearchServiceClient,
    StorageServiceClient,
    TaskServiceClient,
    NotificationServiceClient,
  ],
})
export class ClientsModule {}
