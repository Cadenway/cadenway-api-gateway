import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the set logo operation. */
export class SetLogo {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['setLogo']>
  ): ReturnType<ProfileMediaService['setLogo']> {
    return this.media.setLogo(...args);
  }
  // #endregion
}
