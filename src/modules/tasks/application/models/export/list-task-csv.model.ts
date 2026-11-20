/** A complete UTF-8 list export ready for the HTTP adapter to serve as an attachment. */
export interface ListTaskCsv {
  // #region Properties
  /** The original safe attachment basename. */
  readonly filename: string;

  /** The exact size of the UTF-8 document. */
  readonly byteLength: number;
  // #endregion

  // #region Methods
  /** Reads the prepared document with backpressure. */
  stream(): AsyncIterable<Uint8Array>;

  /** Releases the private file and its export slot. */
  dispose(): Promise<void>;
  // #endregion
}
