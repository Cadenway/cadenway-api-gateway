/** The source image declaration validated at the public boundary. */
export interface MediaDeclaration {
  // #region Properties
  /** Client-declared source content type. */
  readonly contentType: string;

  /** Client-declared source length in bytes. */
  readonly sizeBytes: number;
  // #endregion
}
