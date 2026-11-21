import type { ProfileMediaService } from '../../../../services/profile-media/profile-media.service.js';

/** Coordinates the delete logo operation. */
export class DeleteLogo {
  // #region Constructor
  /** Binds media coordination. */
  public constructor(private readonly media: ProfileMediaService) {}
  // #endregion

  // #region Methods
  /** Executes the requested operation. */
  public execute(
    ...args: Parameters<ProfileMediaService['deleteLogo']>
  ): ReturnType<ProfileMediaService['deleteLogo']> {
    return this.media.deleteLogo(...args);
  }
  // #endregion
}
