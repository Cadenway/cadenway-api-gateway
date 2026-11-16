import { generateKeyPairSync, randomBytes } from 'node:crypto';

import { loadConfig, type Ed25519PublicJwk } from '@cadenway/nest-common';

import { appConfigSchema, type AppConfig } from '../../src/config/app-config.js';

/**
 * Origin of the web application in the tests; the only other allowed one is the website.
 */
export const ALLOWED_ORIGIN = 'https://app.cadenway.test';

/**
 * Origin of the public website in the tests.
 */
export const WEBSITE_ORIGIN = 'https://cadenway.test';

/**
 * Issuer of the internal tokens the gateway signs.
 */
export const GATEWAY_ISSUER = 'api-gateway';

/**
 * A signing key pair generated for one test run: no key is ever committed.
 */
export interface SigningKeys {
  /** `INTERNAL_TOKEN_PRIVATE_JWK`, one line of JSON. */
  readonly privateJwk: string;
  /** The matching public key, for a fake service that verifies the tokens. */
  readonly publicJwk: Ed25519PublicJwk;
}

/**
 * Generates an Ed25519 key pair with a random `kid`.
 *
 * @returns The private key as the gateway reads it, and the public key.
 */
export function generateSigningKeys(): SigningKeys {
  const jwk: JsonWebKey = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  const kid: string = randomBytes(8).toString('hex');
  if (jwk.x === undefined || jwk.d === undefined) {
    throw new Error('The generated Ed25519 key has no x or d.');
  }
  return {
    privateJwk: JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: jwk.x, d: jwk.d, kid }),
    publicJwk: { kty: 'OKP', crv: 'Ed25519', x: jwk.x, kid },
  };
}

/**
 * Environment of the gateway under test. Service addresses default to a port nothing listens on.
 *
 * @param overrides - Variables to replace, such as `REDIS_URL` or `IDENTITY_SERVICE_URL`.
 * @param keys - Signing keys of the run; generated when omitted.
 * @returns The variables, as the process would hold them.
 */
export function testEnvironment(
  overrides: Readonly<Record<string, string>> = {},
  keys: SigningKeys = generateSigningKeys(),
): Record<string, string> {
  return {
    NODE_ENV: 'test',
    PORT: '3000',
    LOG_LEVEL: 'info',
    REDIS_URL: 'redis://127.0.0.1:1',
    ALLOWED_ORIGINS: `${ALLOWED_ORIGIN},${WEBSITE_ORIGIN}`,
    INTERNAL_TOKEN_ISSUER: GATEWAY_ISSUER,
    INTERNAL_TOKEN_PRIVATE_JWK: keys.privateJwk,
    IDENTITY_SERVICE_URL: 'http://127.0.0.1:1',
    ORGANIZATION_SERVICE_URL: 'http://127.0.0.1:1',
    BILLING_SERVICE_URL: 'http://127.0.0.1:1',
    TASK_SERVICE_URL: 'http://127.0.0.1:1',
    DOCUMENT_SERVICE_URL: 'http://127.0.0.1:1',
    STORAGE_SERVICE_URL: 'http://127.0.0.1:1',
    NOTIFICATION_SERVICE_URL: 'http://127.0.0.1:1',
    AUTOMATION_SERVICE_URL: 'http://127.0.0.1:1',
    INTEGRATION_SERVICE_URL: 'http://127.0.0.1:1',
    SEARCH_SERVICE_URL: 'http://127.0.0.1:1',
    ...overrides,
  };
}

/**
 * Validated configuration of the gateway under test, as `main.ts` would load it.
 *
 * @param overrides - Variables to replace.
 * @param keys - Signing keys of the run; generated when omitted.
 * @returns The configuration.
 */
export function testConfig(
  overrides: Readonly<Record<string, string>> = {},
  keys?: SigningKeys,
): Readonly<AppConfig> {
  return loadConfig(appConfigSchema, testEnvironment(overrides, keys));
}
