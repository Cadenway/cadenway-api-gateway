import {
  baseConfigShape,
  internalTokenSignerConfigShape,
  type BaseConfig,
  type InternalTokenSignerConfig,
} from '@cadenway/nest-common';
import { z } from 'zod';

/**
 * Interface AppConfig
 *
 * @description
 * Validated environment of the gateway. Every value comes from the environment and is checked once
 * at start-up: a missing or invalid variable stops the process with a `ConfigError` that names the
 * variable and never prints its value.
 *
 * Besides the variables of every Cadenway backend (`NODE_ENV`, `PORT`, `LOG_LEVEL`, `LOG_PRETTY`),
 * the gateway signs the internal token of the calls it makes (`INTERNAL_TOKEN_ISSUER`,
 * `INTERNAL_TOKEN_PRIVATE_JWK`) and verifies none: it authenticates the applications itself.
 */
export interface AppConfig extends BaseConfig, InternalTokenSignerConfig {
  // #region Properties
  /**
   * Property REDIS_URL
   *
   * @description
   * Address of the Redis server that holds the per-token rate-limit counters, `redis://` or
   * `rediss://`. Redis holds nothing else for the gateway.
   *
   * @type {string}
   * @readonly
   */
  readonly REDIS_URL: string;

  /**
   * Property ALLOWED_ORIGINS
   *
   * @description
   * Browser origins allowed to call the API with credentials: the web application and the public
   * website, read from a comma-separated list such as
   * `https://app.cadenway.com,https://cadenway.com`. Each entry is an exact origin (scheme, host
   * and optional port; no path, no trailing slash, lowercase), never a wildcard. CORS answers these
   * origins only, and the CSRF check of the session cookie compares `Origin` to the same list.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly ALLOWED_ORIGINS: readonly string[];

  /**
   * Property IDENTITY_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-identity-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly IDENTITY_SERVICE_URL: string;

  /**
   * Property ORGANIZATION_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-organization-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly ORGANIZATION_SERVICE_URL: string;

  /**
   * Property BILLING_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-billing-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly BILLING_SERVICE_URL: string;

  /**
   * Property TASK_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-task-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly TASK_SERVICE_URL: string;

  /**
   * Property DOCUMENT_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-document-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly DOCUMENT_SERVICE_URL: string;

  /**
   * Property STORAGE_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-storage-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly STORAGE_SERVICE_URL: string;

  /**
   * Property NOTIFICATION_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-notification-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly NOTIFICATION_SERVICE_URL: string;

  /**
   * Property AUTOMATION_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-automation-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly AUTOMATION_SERVICE_URL: string;

  /**
   * Property INTEGRATION_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-integration-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly INTEGRATION_SERVICE_URL: string;

  /**
   * Property SEARCH_SERVICE_URL
   *
   * @description
   * Base URL of cadenway-search-service on the internal network.
   *
   * @type {string}
   * @readonly
   */
  readonly SEARCH_SERVICE_URL: string;
  // #endregion
}

/**
 * Function isExactOrigin
 *
 * @description
 * Tells whether a text is a serialized origin as a browser sends it in the `Origin` header: an
 * HTTP or HTTPS URL reduced to its scheme, host and port. The comparison with the parsed origin
 * refuses a path, a trailing slash, credentials, uppercase letters and a default port written out,
 * so that an allowed origin can only be compared by exact string equality.
 *
 * @param {string} text - One entry of `ALLOWED_ORIGINS`.
 * @returns {boolean} `true` when the text is an exact HTTP or HTTPS origin.
 */
function isExactOrigin(text: string): boolean {
  if (!URL.canParse(text)) {
    return false;
  }
  const url: URL = new URL(text);
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === text;
}

/**
 * Constant serviceUrlSchema
 *
 * @description
 * Schema of a `<NAME>_SERVICE_URL` variable: an HTTP or HTTPS URL. The internal clients take their
 * base URL from it, never from code.
 *
 * @type {z.ZodType<string>}
 */
const serviceUrlSchema: z.ZodType<string> = z.url({
  protocol: /^https?$/u,
  error: 'Expected an http or https URL.',
});

/**
 * Constant allowedOriginsSchema
 *
 * @description
 * Schema of `ALLOWED_ORIGINS`: a comma-separated list of at least one exact origin. The messages
 * describe the expectation and never repeat the received text.
 *
 * @type {z.ZodType<readonly string[]>}
 */
const allowedOriginsSchema: z.ZodType<readonly string[]> = z
  .string()
  .transform((text: string): string[] => text.split(',').map((entry: string) => entry.trim()))
  .pipe(
    z
      .array(
        z
          .string()
          .refine(
            isExactOrigin,
            'Expected an exact origin such as https://app.example.com: http or https, no path, no trailing slash, lowercase, no wildcard.',
          ),
      )
      .min(1),
  );

/**
 * Constant appConfigSchema
 *
 * @description
 * Zod schema of the environment of the gateway, for `loadConfig` and `ConfigModule.forRoot`.
 * `INTERNAL_TOKEN_ISSUER` and `INTERNAL_TOKEN_PRIVATE_JWK` keep the rules of
 * `@cadenway/nest-common`: a lowercase kebab-case name and one line of JSON holding an Ed25519
 * private JSON Web Key with its `kid`. No variable of this schema has a default except those of
 * `baseConfigShape`.
 *
 * @type {z.ZodType<AppConfig>}
 */
export const appConfigSchema: z.ZodType<AppConfig> = z.object({
  ...baseConfigShape,
  ...internalTokenSignerConfigShape,
  REDIS_URL: z.url({ protocol: /^rediss?$/u, error: 'Expected a redis:// or rediss:// URL.' }),
  ALLOWED_ORIGINS: allowedOriginsSchema,
  IDENTITY_SERVICE_URL: serviceUrlSchema,
  ORGANIZATION_SERVICE_URL: serviceUrlSchema,
  BILLING_SERVICE_URL: serviceUrlSchema,
  TASK_SERVICE_URL: serviceUrlSchema,
  DOCUMENT_SERVICE_URL: serviceUrlSchema,
  STORAGE_SERVICE_URL: serviceUrlSchema,
  NOTIFICATION_SERVICE_URL: serviceUrlSchema,
  AUTOMATION_SERVICE_URL: serviceUrlSchema,
  INTEGRATION_SERVICE_URL: serviceUrlSchema,
  SEARCH_SERVICE_URL: serviceUrlSchema,
});
