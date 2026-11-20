import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the start logo operation. */
export class StartLogo {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['startLogo']>
  ): ReturnType<ProfileMediaService['startLogo']> {
    return this.media.startLogo(...args);
  }
  // #endregion
}
