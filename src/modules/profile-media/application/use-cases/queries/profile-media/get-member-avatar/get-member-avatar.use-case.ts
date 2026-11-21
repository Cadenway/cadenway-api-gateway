import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the get member avatar operation. */
export class GetMemberAvatar {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['getMemberAvatar']>
  ): ReturnType<ProfileMediaService['getMemberAvatar']> {
    return this.media.getMemberAvatar(...args);
  }
  // #endregion
}
