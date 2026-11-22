import { generateKeyPairSync, randomBytes } from 'node:crypto';

import { ConfigError, loadConfig } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { appConfigSchema } from './app-config.js';
import type { AppConfig } from './app-config.js';

/**
 * Function privateJwk
 *
 * @description
 * Generates an Ed25519 private JSON Web Key for one test, as one line of JSON: no key is ever
 * committed, not even a test one.
 *
 * @returns {string} The `INTERNAL_TOKEN_PRIVATE_JWK` value.
 */
function privateJwk(): string {
  const jwk: JsonWebKey = generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' });
  return JSON.stringify({
    kty: 'OKP',
    crv: 'Ed25519',
    x: jwk.x,
    d: jwk.d,
    kid: randomBytes(8).toString('hex'),
  });
}

/**
 * Function validEnvironment
 *
 * @description
 * Builds an environment the schema accepts, with every variable the gateway requires.
 *
 * @param {Record<string, string>} overrides - Variables to replace or add.
 * @returns {Record<string, string>} The environment map.
 */
function validEnvironment(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    PORT: '3000',
    REDIS_URL: 'redis://localhost:6379',
    ALLOWED_ORIGINS: 'https://app.cadenway.test, https://cadenway.test',
    INTERNAL_TOKEN_ISSUER: 'api-gateway',
    INTERNAL_TOKEN_PRIVATE_JWK: privateJwk(),
    IDENTITY_SERVICE_URL: 'http://localhost:3010',
    ORGANIZATION_SERVICE_URL: 'http://localhost:3011',
    BILLING_SERVICE_URL: 'http://localhost:3012',
    TASK_SERVICE_URL: 'http://localhost:3013',
    DOCUMENT_SERVICE_URL: 'http://localhost:3014',
    STORAGE_SERVICE_URL: 'http://localhost:3015',
    NOTIFICATION_SERVICE_URL: 'http://localhost:3016',
    AUTOMATION_SERVICE_URL: 'http://localhost:3017',
    INTEGRATION_SERVICE_URL: 'http://localhost:3018',
    SEARCH_SERVICE_URL: 'http://localhost:3019',
    ...overrides,
  };
}

/**
 * Function configIssues
 *
 * @description
 * Loads an environment that must be refused and returns the issues of the `ConfigError`.
 *
 * @param {Record<string, string>} env - Environment to validate.
 * @returns {readonly string[]} One `<NAME>: <reason>` entry per invalid variable.
 * @throws {Error} When the environment is accepted.
 */
function configIssues(env: Record<string, string>): readonly string[] {
  try {
    loadConfig(appConfigSchema, env);
  } catch (error: unknown) {
    if (error instanceof ConfigError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error('The environment was accepted.');
}

describe('appConfigSchema', () => {
  it('leaves federated sign-in disabled when Compose passes an empty continuation', () => {
    const config = loadConfig(
      appConfigSchema,
      validEnvironment({ FEDERATED_CONTINUATION_URL: '' }),
    );
    expect(config.FEDERATED_CONTINUATION_URL).toBeUndefined();
  });

  it('allows the fixed continuation on the local Webapp origin', () => {
    const url = 'http://app.cadenway.localhost/auth/federated/continue';
    const config = loadConfig(
      appConfigSchema,
      validEnvironment({
        ALLOWED_ORIGINS: 'http://app.cadenway.localhost',
        FEDERATED_CONTINUATION_URL: url,
      }),
    );
    expect(config.FEDERATED_CONTINUATION_URL).toBe(url);
  });

  it.each([
    'https://different.example.test/auth/federated/continue',
    'https://app.cadenway.test/auth/federated/continue?next=/',
    'https://app.cadenway.test/other',
  ])('refuses an unmatched or noncanonical federation continuation', (url) => {
    expect(configIssues(validEnvironment({ FEDERATED_CONTINUATION_URL: url }))).toEqual([
      expect.stringMatching(/^FEDERATED_CONTINUATION_URL: /u),
    ]);
  });

  it('reads a complete environment with the defaults of the kit', () => {
    const config: Readonly<AppConfig> = loadConfig(appConfigSchema, validEnvironment());

    expect(config).toMatchObject({
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info',
      LOG_PRETTY: false,
      REDIS_URL: 'redis://localhost:6379',
      INTERNAL_TOKEN_ISSUER: 'api-gateway',
      TASK_SERVICE_URL: 'http://localhost:3013',
    });
    expect(config.ALLOWED_ORIGINS).toEqual(['https://app.cadenway.test', 'https://cadenway.test']);
    expect(config.INTERNAL_TOKEN_PRIVATE_JWK).toMatchObject({ kty: 'OKP', crv: 'Ed25519' });
  });

  it('refuses to start without the signing key and names the variable', () => {
    const env: Record<string, string> = validEnvironment();
    delete env.INTERNAL_TOKEN_PRIVATE_JWK;

    expect(configIssues(env)).toEqual([expect.stringMatching(/^INTERNAL_TOKEN_PRIVATE_JWK: /u)]);
    expect(configIssues(validEnvironment({ INTERNAL_TOKEN_PRIVATE_JWK: '' }))).toEqual([
      expect.stringMatching(/^INTERNAL_TOKEN_PRIVATE_JWK: /u),
    ]);
  });

  it('never prints the value of a refused signing key', () => {
    const publicOnly: string = JSON.stringify({
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'A'.repeat(43),
      kid: 'secret-kid-value',
    });

    const issues: readonly string[] = configIssues(
      validEnvironment({ INTERNAL_TOKEN_PRIVATE_JWK: publicOnly }),
    );

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue: string) => issue.startsWith('INTERNAL_TOKEN_PRIVATE_JWK'))).toBe(
      true,
    );
    expect(issues.join('\n')).not.toContain('secret-kid-value');
  });

  it('requires every variable the gateway reads', () => {
    expect(configIssues({}).map((issue: string) => issue.split(':')[0])).toEqual([
      'PORT',
      'INTERNAL_TOKEN_ISSUER',
      'INTERNAL_TOKEN_PRIVATE_JWK',
      'REDIS_URL',
      'ALLOWED_ORIGINS',
      'IDENTITY_SERVICE_URL',
      'ORGANIZATION_SERVICE_URL',
      'BILLING_SERVICE_URL',
      'TASK_SERVICE_URL',
      'DOCUMENT_SERVICE_URL',
      'STORAGE_SERVICE_URL',
      'NOTIFICATION_SERVICE_URL',
      'AUTOMATION_SERVICE_URL',
      'INTEGRATION_SERVICE_URL',
      'SEARCH_SERVICE_URL',
    ]);
  });

  it.each([
    ['a wildcard', '*'],
    ['a trailing slash', 'https://app.cadenway.test/'],
    ['a path', 'https://app.cadenway.test/login'],
    ['uppercase letters', 'https://App.cadenway.test'],
    ['another scheme', 'ftp://app.cadenway.test'],
    ['an empty entry', 'https://app.cadenway.test,'],
    ['the null origin', 'null'],
  ])('refuses an allowed origin with %s', (_label: string, origins: string) => {
    const issues: readonly string[] = configIssues(validEnvironment({ ALLOWED_ORIGINS: origins }));

    expect(issues).toEqual([expect.stringMatching(/^ALLOWED_ORIGINS(\.\d+)?: /u)]);
    expect(issues.join('\n')).not.toContain(origins);
  });

  it('accepts an origin with an explicit port, as on a workstation', () => {
    const config: Readonly<AppConfig> = loadConfig(
      appConfigSchema,
      validEnvironment({ ALLOWED_ORIGINS: 'http://localhost:4200' }),
    );

    expect(config.ALLOWED_ORIGINS).toEqual(['http://localhost:4200']);
  });

  it('refuses a service address that is not an http or https URL', () => {
    expect(configIssues(validEnvironment({ TASK_SERVICE_URL: 'task-service:3013' }))).toEqual([
      'TASK_SERVICE_URL: Expected an http or https URL.',
    ]);
    expect(configIssues(validEnvironment({ SEARCH_SERVICE_URL: 'ftp://localhost:3019' }))).toEqual([
      'SEARCH_SERVICE_URL: Expected an http or https URL.',
    ]);
  });

  it('refuses a Redis address that is not a redis URL', () => {
    expect(configIssues(validEnvironment({ REDIS_URL: 'http://localhost:6379' }))).toEqual([
      'REDIS_URL: Expected a redis:// or rediss:// URL.',
    ]);
  });
});
