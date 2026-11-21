import { getOrganizationContext, ProblemException } from '@cadenway/nest-common';

import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';
import type { StorageServiceClient } from '../../../../../clients/storage-service.client.js';
import type { ProfileMediaPort } from '../../../application/ports/outbound/services/profile-media/profile-media.port.js';

/** Connects the media capability to the validated service clients. */
export function createProfileMediaAdapter(
  identity: IdentityServiceClient,
  organizations: OrganizationServiceClient,
  storage: StorageServiceClient,
): ProfileMediaPort {
  return {
    reserveAvatar: (userId, body, key) => identity.reserveAvatarUpload(userId, body, key),
    reserveLogo: (body, key) => organizations.reserveOrganizationLogoUpload(body, key),
    avatarReservation: (userId, uploadId) => identity.getAvatarUploadState(userId, uploadId),
    logoReservation: (uploadId) => organizations.getOrganizationLogoUploadState(uploadId),
    sign: (uploadId, kind, expiresAt, declaration) =>
      storage.signProfileMediaTransfer(
        uploadId,
        { kind, expiresAt, ...declaration },
        kind === 'avatar' ? 'account' : 'organization',
      ),
    prepare: async (uploadId, kind) => {
      await storage.prepareProfileMedia(
        uploadId,
        { kind },
        kind === 'avatar' ? 'account' : 'organization',
      );
    },
    setAvatar: async (userId, uploadId, ifMatch) =>
      (await identity.setAvatar(userId, uploadId, ifMatch)).etag,
    setLogo: async (uploadId, ifMatch) =>
      (await organizations.setOrganizationLogo(uploadId, ifMatch)).etag,
    deleteAvatar: async (userId, ifMatch) => (await identity.deleteAvatar(userId, ifMatch)).etag,
    deleteLogo: async (ifMatch) => (await organizations.deleteOrganizationLogo(ifMatch)).etag,
    avatarReference: async (userId) => (await identity.getAvatarReference(userId)).assetId,
    logoReference: async () => {
      const organization = await organizations.getOrganization();
      const organizationId = getOrganizationContext()?.organizationId;
      if (organization.id.toLowerCase() !== organizationId?.toLowerCase()) {
        throw new ProblemException({
          status: 503,
          code: 'upstream.failed',
          details: { service: 'organization-service' },
        });
      }
      if (organization.logoId === undefined) {
        throw new ProblemException({
          status: 503,
          code: 'upstream.failed',
          details: { service: 'organization-service' },
        });
      }
      return organization.logoId;
    },
    memberUserId: async (memberId) => {
      const member = await organizations.getMember(memberId);
      if (member.id.toLowerCase() !== memberId.toLowerCase()) {
        throw new ProblemException({
          status: 503,
          code: 'upstream.failed',
          details: { service: 'organization-service' },
        });
      }
      return member.userId;
    },
    avatarImage: (assetId, ownerUserId, directory) =>
      storage.getAvatarImage(assetId, ownerUserId, directory ? 'organization' : 'account'),
    logoImage: (assetId) => storage.getOrganizationLogoImage(assetId),
  };
}
