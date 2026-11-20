import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the get avatar operation. */
export class GetAvatar {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['getAvatar']>
  ): ReturnType<ProfileMediaService['getAvatar']> {
    return this.media.getAvatar(...args);
  }
  // #endregion
}
