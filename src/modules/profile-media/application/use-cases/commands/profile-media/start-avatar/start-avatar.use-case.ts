import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the start avatar operation. */
export class StartAvatar {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['startAvatar']>
  ): ReturnType<ProfileMediaService['startAvatar']> {
    return this.media.startAvatar(...args);
  }
  // #endregion
}
