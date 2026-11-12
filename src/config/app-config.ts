/** Port the gateway listens on when `PORT` is not set: the local port documented for it. */
export const DEFAULT_PORT = 3000;

/**
 * Start-up settings read from the environment.
 *
 * Bootstrap placeholder: the typed, validated configuration of `@cadenway/nest-common` replaces it
 * once that package is published.
 */
export interface AppConfig {
  /** TCP port of the public HTTP API. */
  readonly port: number;
}

/**
 * Reads the start-up settings from an environment map.
 *
 * @param env Environment variables, usually `process.env`.
 * @returns The validated settings.
 * @throws {RangeError} When `PORT` is set but is not an integer between 1 and 65535.
 */
export function loadAppConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const raw = env.PORT;
  if (raw === undefined || raw === '') {
    return { port: DEFAULT_PORT };
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new RangeError(`PORT must be an integer between 1 and 65535, received "${raw}".`);
  }
  return { port };
}
