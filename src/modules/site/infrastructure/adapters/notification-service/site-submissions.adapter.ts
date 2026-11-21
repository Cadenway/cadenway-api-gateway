import type { NotificationServiceClient } from '../../../../../clients/notification-service.client.js';
import type { SiteSubmissions } from '../../../application/ports/outbound/notification-service/forms/site-submissions.port.js';

type SiteOperations = Pick<
  NotificationServiceClient,
  'submitContactForm' | 'subscribeToNewsletter'
>;

/** Binds the signed, generated Notification client to the site submission port. */
export function createSiteSubmissions(client: SiteOperations): SiteSubmissions {
  return {
    contact: (body, key) => client.submitContactForm(body, key),
    newsletter: (body) => client.subscribeToNewsletter(body),
  };
}
