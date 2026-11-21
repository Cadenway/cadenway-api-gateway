import type { MediaDeclaration } from '../../models/profile-media/media-declaration.model.js';
import type { MediaUpload } from '../../models/profile-media/media-upload.model.js';
import type { ProfileMediaPort } from '../../ports/outbound/services/profile-media/profile-media.port.js';

/** Coordinates owner reservations and private storage without taking ownership decisions. */
export class ProfileMediaService {
  // #region Constructor
  /** Binds the validated internal service operations. */
  public constructor(private readonly media: ProfileMediaPort) {}
  // #endregion

  // #region Methods
  /** Reserves the account image before signing its transfer. */
  public async startAvatar(
    userId: string,
    declaration: MediaDeclaration,
    key?: string,
  ): Promise<MediaUpload> {
    const reservation = await this.media.reserveAvatar(userId, declaration, key);
    return this.media.sign(reservation.uploadId, 'avatar', reservation.expiresAt, declaration);
  }

  /** Reserves an authorized organization image before signing its transfer. */
  public async startLogo(declaration: MediaDeclaration, key?: string): Promise<MediaUpload> {
    const reservation = await this.media.reserveLogo(declaration, key);
    return this.media.sign(
      reservation.uploadId,
      'organization-logo',
      reservation.expiresAt,
      declaration,
    );
  }

  /** Prepares a pending account image and asks Identity to commit or replay. */
  public async setAvatar(userId: string, uploadId: string, ifMatch?: string): Promise<string> {
    const reservation = await this.media.avatarReservation(userId, uploadId);
    if (reservation.state === 'pending') await this.media.prepare(uploadId, 'avatar');
    return this.media.setAvatar(userId, uploadId, ifMatch);
  }

  /** Prepares a pending logo and asks Organization to commit or replay. */
  public async setLogo(uploadId: string, ifMatch?: string): Promise<string> {
    const reservation = await this.media.logoReservation(uploadId);
    if (reservation.state === 'pending') await this.media.prepare(uploadId, 'organization-logo');
    return this.media.setLogo(uploadId, ifMatch);
  }

  /** Clears the account reference and lets Identity fence pending reservations. */
  public deleteAvatar(userId: string, ifMatch?: string): Promise<string> {
    return this.media.deleteAvatar(userId, ifMatch);
  }

  /** Clears the organization reference and lets Organization fence reservations. */
  public deleteLogo(ifMatch?: string): Promise<string> {
    return this.media.deleteLogo(ifMatch);
  }

  /** Resolves the current account image before reading private bytes. */
  public async getAvatar(userId: string): Promise<Buffer | null> {
    const assetId = await this.media.avatarReference(userId);
    return assetId === null ? null : this.media.avatarImage(assetId, userId, false);
  }

  /** Resolves membership and the current account image before reading private bytes. */
  public async getMemberAvatar(memberId: string): Promise<Buffer | null> {
    const userId = await this.media.memberUserId(memberId);
    const assetId = await this.media.avatarReference(userId);
    return assetId === null ? null : this.media.avatarImage(assetId, userId, true);
  }

  /** Resolves current organization access and logo together before reading bytes. */
  public async getLogo(): Promise<Buffer | null> {
    const assetId = await this.media.logoReference();
    return assetId === null ? null : this.media.logoImage(assetId);
  }
  // #endregion
}
