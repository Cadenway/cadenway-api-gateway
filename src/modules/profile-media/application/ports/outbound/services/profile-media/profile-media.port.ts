import type { MediaDeclaration } from '../../../../models/profile-media/media-declaration.model.js';
import type { MediaReservation } from '../../../../models/profile-media/media-reservation.model.js';
import type { MediaReservationState } from '../../../../models/profile-media/media-reservation-state.model.js';
import type { MediaUpload } from '../../../../models/profile-media/media-upload.model.js';

/** Calls owner services and Storage using the currently verified actor. */
export interface ProfileMediaPort {
  // #region Methods
  /** Reserves an avatar against current account state. */
  reserveAvatar(
    userId: string,
    declaration: MediaDeclaration,
    key?: string,
  ): Promise<MediaReservation>;

  /** Reserves a logo against current organization state. */
  reserveLogo(declaration: MediaDeclaration, key?: string): Promise<MediaReservation>;

  /** Rechecks an avatar reservation before publishing. */
  avatarReservation(userId: string, uploadId: string): Promise<MediaReservationState>;

  /** Rechecks a logo reservation before publishing. */
  logoReservation(uploadId: string): Promise<MediaReservationState>;

  /** Signs the transfer for an owner-approved reservation. */
  sign(
    uploadId: string,
    kind: 'avatar' | 'organization-logo',
    expiresAt: string,
    declaration: MediaDeclaration,
  ): Promise<MediaUpload>;

  /** Verifies and prepares an owner-approved pending upload. */
  prepare(uploadId: string, kind: 'avatar' | 'organization-logo'): Promise<void>;

  /** Publishes or replays an avatar and returns the account ETag. */
  setAvatar(userId: string, uploadId: string, ifMatch?: string): Promise<string>;

  /** Publishes or replays a logo and returns the organization ETag. */
  setLogo(uploadId: string, ifMatch?: string): Promise<string>;

  /** Clears the avatar and returns the account ETag. */
  deleteAvatar(userId: string, ifMatch?: string): Promise<string>;

  /** Clears the logo and returns the organization ETag. */
  deleteLogo(ifMatch?: string): Promise<string>;

  /** Reads the account's current image reference. */
  avatarReference(userId: string): Promise<string | null>;

  /** Reads the current logo with live organization access. */
  logoReference(): Promise<string | null>;

  /** Resolves an account using live member access. */
  memberUserId(memberId: string): Promise<string>;

  /** Reads an authorized account derivative with its proper scope. */
  avatarImage(assetId: string, ownerUserId: string, directory: boolean): Promise<Buffer>;

  /** Reads the authorized organization's current logo derivative. */
  logoImage(assetId: string): Promise<Buffer>;
  // #endregion
}
