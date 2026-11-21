import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the set avatar operation. */
export class SetAvatar {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['setAvatar']>
  ): ReturnType<ProfileMediaService['setAvatar']> {
    return this.media.setAvatar(...args);
  }
  // #endregion
}
