import type {
  OpenSession as PublicOpenSession,
  OpenSessionPage as PublicOpenSessionPage,
} from '@cadenway/contracts/types/public/auth';

import type { OpenSession } from '../../../../application/models/sessions/open-session.model.js';
import type { OpenSessionPage } from '../../../../application/models/sessions/open-session-page.model.js';

/**
 * Function toOpenSession
 *
 * @description
 * Maps a session to `OpenSession` of `openapi/public/auth.yaml`, member by member: its id, never
 * its token, and the inactivity of the policy of its current organization when identity-service
 * sends it.
 *
 * @param {OpenSession} session - The session.
 * @returns {PublicOpenSession} The public session.
 */
export function toOpenSession(session: OpenSession): PublicOpenSession {
  return {
    id: session.id,
    current: session.current,
    device: {
      type: session.device.type,
      browser: session.device.browser,
      browserVersion: session.device.browserVersion,
      os: session.device.os,
      osVersion: session.device.osVersion,
    },
    ipAddress: session.ipAddress,
    signedInAt: session.signedInAt,
    lastActiveAt: session.lastActiveAt,
    expiresAt: session.expiresAt,
    ...(session.inactivityTimeoutMinutes === undefined
      ? {}
      : { inactivityTimeoutMinutes: session.inactivityTimeoutMinutes }),
  };
}

/**
 * Function toOpenSessionPage
 *
 * @description
 * Maps a page of sessions to `OpenSessionPage`, member by member.
 *
 * @param {OpenSessionPage} page - The page.
 * @returns {PublicOpenSessionPage} The public page.
 */
export function toOpenSessionPage(page: OpenSessionPage): PublicOpenSessionPage {
  return { items: page.items.map(toOpenSession), nextCursor: page.nextCursor };
}
