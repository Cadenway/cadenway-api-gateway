import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the delete avatar operation. */
export class DeleteAvatar {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['deleteAvatar']>
  ): ReturnType<ProfileMediaService['deleteAvatar']> {
    return this.media.deleteAvatar(...args);
  }
  // #endregion
}
