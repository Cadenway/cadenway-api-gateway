import {
  CompleteOAuthSignInQueryParams,
  CompleteSamlSignInBody,
} from '@cadenway/contracts/validators/public/auth';
import { ProblemException } from '@cadenway/nest-common';
import type { Request } from 'express';
import type { z } from 'zod';

import type { FederatedOAuthCallback } from '@cadenway/contracts/types/internal/identity-service';

const OAUTH_FIELDS = new Set(['state', 'code', 'error']);
const OAUTH_OPTIONAL_FIELDS = new Set([
  'authuser',
  'error_description',
  'error_uri',
  'hd',
  'iss',
  'prompt',
  'scope',
  'session_state',
]);
const SAML_FIELDS = new Set(['SAMLResponse', 'RelayState']);

function invalidCallback(source: 'query' | 'body', path = ''): ProblemException {
  return new ProblemException({
    status: 400,
    code: 'request.invalid',
    details: {
      issues: [{ in: source, path, code: 'invalid_format', message: 'Invalid callback data.' }],
    },
  });
}

// Handle percent decoding strictly and check duplicates before building a DTO. In particular,
// parsed form objects can lose names that collide with object prototype properties.
function callbackFields(
  raw: string,
  source: 'query' | 'body',
  names: ReadonlySet<string>,
  ignored: ReadonlySet<string> = new Set(),
): Record<string, string> {
  const fields = new Map<string, string>();
  for (const field of raw.split('&')) {
    if (field === '') continue;

    const separator = field.indexOf('=');
    const key = separator === -1 ? field : field.slice(0, separator);
    const name = decodeField(key, source);
    if (ignored.has(name)) continue;

    if (!names.has(name)) throw invalidCallback(source);
    if (fields.has(name)) throw invalidCallback(source, name);
    if (separator === -1) throw invalidCallback(source, name);

    fields.set(name, decodeField(field.slice(separator + 1), source));
  }
  return Object.fromEntries(fields);
}

function decodeField(value: string, source: 'query' | 'body'): string {
  try {
    return decodeURIComponent(value.replaceAll('+', ' '));
  } catch {
    throw invalidCallback(source);
  }
}

/** Reads only one state and one OAuth outcome from the raw provider query. */
export function readOAuthCallback(
  originalUrl: string,
): Pick<FederatedOAuthCallback, 'state' | 'response'> {
  const separator = originalUrl.indexOf('?');
  const query = separator === -1 ? '' : originalUrl.slice(separator + 1);
  const fields = CompleteOAuthSignInQueryParams.safeParse(
    callbackFields(query, 'query', OAUTH_FIELDS, OAUTH_OPTIONAL_FIELDS),
  );
  if (!fields.success) {
    const path = fields.error.issues[0]?.path[0];
    throw invalidCallback('query', typeof path === 'string' ? path : '');
  }
  const { state, code, error } = fields.data;
  if (code !== undefined && error === undefined) {
    return { state, response: { outcome: 'authorized', code } };
  }
  if (error !== undefined && code === undefined) {
    return { state, response: { outcome: 'denied', error } };
  }
  throw invalidCallback('query');
}

/** Reads the two SAML POST-binding fields from the raw form and checks bounded Base64. */
export function readSamlCallback(request: Request): z.output<typeof CompleteSamlSignInBody> {
  const body: unknown = request.body;
  if (
    request.is('application/x-www-form-urlencoded') !== 'application/x-www-form-urlencoded' ||
    typeof body !== 'string'
  ) {
    throw invalidCallback('body');
  }
  const fields = CompleteSamlSignInBody.safeParse(callbackFields(body, 'body', SAML_FIELDS));
  if (!fields.success) {
    const path = fields.error.issues[0]?.path[0];
    throw invalidCallback('body', typeof path === 'string' ? path : '');
  }
  const assertion = Buffer.from(fields.data.SAMLResponse, 'base64');
  if (assertion.toString('base64') !== fields.data.SAMLResponse) {
    throw invalidCallback('body', 'SAMLResponse');
  }
  return fields.data;
}
