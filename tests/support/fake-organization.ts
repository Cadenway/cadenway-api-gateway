import type {
  Invitation,
  Member,
  MyOrganization,
  Organization,
  ReceivedInvitation,
} from '@cadenway/contracts/types/internal/organization-service';
import { vi, type Mock } from 'vitest';

import type { OrganizationServiceClient } from '../../src/clients/organization-service.client.js';
import { ATELIER_NORD_ID, CAMILLE } from './fake-identity.js';

/**
 * Atelier Nord read by its owner, as organization-service returns it (the example of the
 * contract).
 */
export const ATELIER_NORD: Organization = {
  id: ATELIER_NORD_ID,
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  description:
    'Studio de conception de mobilier et d’aménagement, 18 personnes entre Lille et Lyon.',
  website: 'https://ateliernord.fr',
  defaultLanguage: 'fr',
  plan: 'free',
  memberCount: 18,
  role: 'owner',
  createdAt: '2026-03-02T09:00:00Z',
  version: 3,
};

/**
 * Atelier Nord as the picker lists it.
 */
export const MY_ATELIER_NORD: MyOrganization = {
  id: ATELIER_NORD_ID,
  name: 'Atelier Nord',
  slug: 'atelier-nord',
  role: 'owner',
  memberCount: 18,
  plan: 'free',
  joinedAt: '2026-03-02T09:00:00Z',
};

/**
 * Inès Robert, admin of Atelier Nord.
 */
export const INES: Member = {
  id: '019a5f3d-1a2b-7c3d-8e4f-5a6b7c8d9e41',
  userId: '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31',
  name: 'Inès Robert',
  email: 'ines.robert@ateliernord.fr',
  role: 'admin',
  joinedAt: '2026-03-03T09:40:00Z',
  version: 2,
};

/**
 * Camille Martin, owner of Atelier Nord.
 */
export const CAMILLE_MEMBER: Member = {
  id: '019a5f3d-1a2b-7c3d-8e4f-5a6b7c8d9e40',
  userId: CAMILLE.id,
  name: CAMILLE.name,
  email: CAMILLE.email,
  role: 'owner',
  joinedAt: '2026-03-02T09:00:00Z',
  version: 1,
};

/**
 * A pending invitation of Atelier Nord.
 */
export const MARC_INVITATION: Invitation = {
  id: '019a6b10-3c4d-7e5f-8a6b-7c8d9e0f1a70',
  email: 'marc.roux@ateliernord.fr',
  role: 'member',
  invitedBy: { userId: INES.userId, name: INES.name },
  status: 'pending',
  sentAt: '2026-11-06T16:20:00Z',
  expiresAt: '2026-11-13T16:20:00Z',
  version: 1,
};

/**
 * An invitation addressed to Camille by another organization.
 */
export const LUMEN_INVITATION: ReceivedInvitation = {
  id: '019a6b20-5e6f-7a8b-9c0d-1e2f3a4b5c80',
  organization: {
    id: '019a5f41-7c2e-7a3b-9d4f-6e8a0b2c4d61',
    name: 'Coopérative Lumen',
    slug: 'lumen',
    description: null,
    memberCount: 41,
  },
  role: 'member',
  invitedBy: { userId: INES.userId, name: INES.name },
  expiresAt: '2026-11-15T10:00:00Z',
};

/**
 * Public methods of the organization-service client.
 */
type OrganizationMethod = {
  [K in keyof OrganizationServiceClient]: OrganizationServiceClient[K] extends (
    ...args: never[]
  ) => unknown
    ? K
    : never;
}[keyof OrganizationServiceClient];

/**
 * The fake of organization-service: one mock per method of its client.
 */
export type FakeOrganization = {
  readonly [K in OrganizationMethod]: Mock<OrganizationServiceClient[K]>;
};

/**
 * Builds a fake whose routes fail until a test gives them an answer.
 *
 * @returns The fake.
 */
export function createFakeOrganization(): FakeOrganization {
  const unexpected = (): Promise<never> => Promise.reject(new Error('Unexpected call.'));
  return {
    createOrganization: vi.fn(unexpected),
    listMyOrganizations: vi.fn(unexpected),
    getOrganization: vi.fn(unexpected),
    reserveOrganizationLogoUpload: vi.fn(unexpected),
    getOrganizationLogoUploadState: vi.fn(unexpected),
    setOrganizationLogo: vi.fn(unexpected),
    deleteOrganizationLogo: vi.fn(unexpected),
    updateOrganization: vi.fn(unexpected),
    listMembers: vi.fn(unexpected),
    lookupMemberNames: vi.fn(unexpected),
    getMember: vi.fn(unexpected),
    changeMemberRole: vi.fn(unexpected),
    removeMember: vi.fn(unexpected),
    inviteMembers: vi.fn(unexpected),
    listInvitations: vi.fn(unexpected),
    revokeInvitation: vi.fn(unexpected),
    resendInvitation: vi.fn(unexpected),
    listReceivedInvitations: vi.fn(unexpected),
    acceptInvitation: vi.fn(unexpected),
    refuseInvitation: vi.fn(unexpected),
  };
}
