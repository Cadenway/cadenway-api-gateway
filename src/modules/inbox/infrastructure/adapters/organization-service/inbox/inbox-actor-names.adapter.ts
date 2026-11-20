import type { OrganizationServiceClient } from '../../../../../../clients/organization-service.client.js';
import type { InboxActorNames } from '../../../../application/ports/outbound/organization-service/inbox/inbox-actor-names.port.js';

/** Enriches only already-visible records with current member names. */
export function inboxActorNames(client: OrganizationServiceClient): InboxActorNames {
  return { lookup: (userIds, signal) => client.lookupMemberNames(userIds, signal) };
}
