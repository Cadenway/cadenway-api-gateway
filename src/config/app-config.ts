/**
 * Constant DEFAULT_PORT
 *
 * @description
 * Local port used when `PORT` is not set.
 *
 * @type {number}
 */
export const DEFAULT_PORT: number = 3000;

/**
 * Interface AppConfig
 *
 * @description
 * Start-up settings read from the environment.
 *
 * Bootstrap placeholder: the typed, validated configuration of `@cadenway/nest-common` replaces it
 * once that package is published.
 */
export interface AppConfig {
  // #region Properties
  /**
   * Property port
   *
   * @description
   * TCP port of the public HTTP API.
   *
   * @type {number}
   * @readonly
   */
  readonly port: number;
  // #endregion
}

/**
 * Function loadAppConfig
 *
 * @description
 * Reads the start-up settings from an environment map.
 *
 * @param {Readonly<Record<string, string | undefined>>} env - Environment variables, usually `process.env`.
 * @returns {AppConfig} The validated settings.
 * @throws {RangeError} When `PORT` is set but is not an integer between 1 and 65535.
 */
export function loadAppConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const raw: string | undefined = env.PORT;
  if (raw === undefined || raw === '') {
    return { port: DEFAULT_PORT };
  }
  const port: number = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`PORT must be an integer between 1 and 65535, received "${raw}".`);
  }
  return { port };
}
