import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the get logo operation. */
export class GetLogo {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['getLogo']>
  ): ReturnType<ProfileMediaService['getLogo']> {
    return this.media.getLogo(...args);
  }
  // #endregion
}
