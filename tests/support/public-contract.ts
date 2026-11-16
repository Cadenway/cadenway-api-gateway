import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import ajvModule, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import ajvFormatsModule from 'ajv-formats';
import type request from 'supertest';
import { parse } from 'yaml';

/**
 * A node of the parsed spec.
 */
type SpecNode = Readonly<Record<string, unknown>>;

/**
 * Id under which the spec is registered with Ajv, so that a schema is referenced by its pointer.
 */
const SPEC_ID = 'public-auth.yaml';

/**
 * Path of `openapi/public/auth.yaml` as the installed `@cadenway/contracts` ships it, bundled into
 * one file: the routes are checked against the contract the gateway depends on, never a sibling
 * checkout.
 */
export const PUBLIC_AUTH_SPEC_PATH: string = createRequire(import.meta.url).resolve(
  '@cadenway/contracts/specs/openapi/public/auth.yaml',
);

/**
 * The parsed public spec.
 */
export const PUBLIC_AUTH_SPEC: SpecNode = parse(
  readFileSync(PUBLIC_AUTH_SPEC_PATH, 'utf8'),
) as SpecNode;

/**
 * Ajv for JSON Schema 2020-12, the dialect of OpenAPI 3.1, with the formats the spec uses
 * (`email`, `uuid`, `date-time`, `uri-reference`). `strict: false` lets the OpenAPI keywords
 * (`x-extensible-enum`, `example`) through without failing.
 */
const ajv = new ajvModule.default({ strict: false, allErrors: true });
ajvFormatsModule.default(ajv);
ajv.addSchema(PUBLIC_AUTH_SPEC, SPEC_ID);

/**
 * Compiled validators, by JSON pointer.
 */
const validators = new Map<string, ValidateFunction>();

/**
 * Narrows a value to an object node of the spec.
 *
 * @param value - Any value of the spec.
 * @returns Whether it is an object.
 */
function isNode(value: unknown): value is SpecNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Escapes one segment of a JSON pointer (RFC 6901).
 *
 * @param segment - Segment to escape.
 * @returns The escaped segment.
 */
function escapePointer(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Reads the node at a JSON pointer of the spec.
 *
 * @param pointer - Pointer such as `/components/responses/SignedIn`.
 * @returns The node.
 */
function nodeAt(pointer: string): SpecNode {
  let node: unknown = PUBLIC_AUTH_SPEC;
  for (const segment of pointer.split('/').slice(1)) {
    const key: string = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    node = isNode(node) ? node[key] : undefined;
  }
  if (!isNode(node)) {
    throw new Error(`The public spec has no object at ${pointer}.`);
  }
  return node;
}

/**
 * Follows a local `$ref`, keeping the pointer of the node reached.
 *
 * @param pointer - Pointer of a node that may be a reference.
 * @returns The pointer and the node it resolves to.
 */
function resolve(pointer: string): { pointer: string; node: SpecNode } {
  const node: SpecNode = nodeAt(pointer);
  const reference: unknown = node.$ref;
  if (typeof reference === 'string' && reference.startsWith('#/')) {
    return resolve(reference.slice(1));
  }
  return { pointer, node };
}

/**
 * Validates a value against the schema at a pointer of the spec.
 *
 * @param pointer - Pointer of the schema.
 * @param value - Value to validate.
 * @returns The errors, empty when the value is valid.
 */
function schemaErrors(pointer: string, value: unknown): readonly ErrorObject[] {
  let validate: ValidateFunction | undefined = validators.get(pointer);
  if (validate === undefined) {
    validate = ajv.compile({ $ref: `${SPEC_ID}#${pointer}` });
    validators.set(pointer, validate);
  }
  return validate(value) ? [] : (validate.errors ?? []);
}

/**
 * Lists the statuses an operation of the public spec declares.
 *
 * @param method - Method of the route.
 * @param path - Path of the route, as the spec writes it.
 * @returns The declared statuses.
 */
export function declaredStatuses(method: 'get' | 'post', path: string): readonly number[] {
  const responses: SpecNode = nodeAt(`/paths/${escapePointer(path)}/${method}/responses`);
  return Object.keys(responses).map(Number);
}

/**
 * Checks a response of the gateway against its operation in `openapi/public/auth.yaml`: the status
 * is one the operation declares, the media type and the body match the declared content (the
 * shared problem schema for an error), a response without content has no body, and every header
 * the response declares (`Set-Cookie`, `Retry-After`, `ETag`) is present.
 *
 * @param method - Method of the route.
 * @param path - Path of the route, as the spec writes it.
 * @param response - Response of supertest.
 * @throws {Error} Naming every mismatch.
 */
export function expectPublicResponse(
  method: 'get' | 'post',
  path: string,
  response: request.Response,
): void {
  const operation = `/paths/${escapePointer(path)}/${method}`;
  const responses: SpecNode = nodeAt(`${operation}/responses`);
  const status = String(response.status);
  if (!(status in responses)) {
    throw new Error(
      `${method.toUpperCase()} ${path} answered ${status}, which the public contract does not declare (${Object.keys(responses).join(', ')}): ${JSON.stringify(response.body)}`,
    );
  }
  const declared: { pointer: string; node: SpecNode } = resolve(`${operation}/responses/${status}`);
  const problems: string[] = [];
  const headers: unknown = declared.node.headers;
  if (isNode(headers)) {
    for (const name of Object.keys(headers)) {
      if (response.headers[name.toLowerCase()] === undefined) {
        problems.push(`the declared header ${name} is missing`);
      }
    }
  }
  const content: unknown = declared.node.content;
  if (isNode(content)) {
    const mediaType: string | undefined = response.headers['content-type']
      ?.split(';', 1)[0]
      ?.trim();
    if (mediaType === undefined || !(mediaType in content)) {
      problems.push(
        `the media type ${String(mediaType)} is not one of ${Object.keys(content).join(', ')}`,
      );
    } else {
      const errors: readonly ErrorObject[] = schemaErrors(
        `${declared.pointer}/content/${escapePointer(mediaType)}/schema`,
        response.body,
      );
      problems.push(
        ...errors.map(
          (error: ErrorObject) => `body${error.instancePath} ${error.message ?? 'is invalid'}`,
        ),
      );
    }
  } else if (response.text !== '') {
    problems.push('a response without content has a body');
  }
  if (problems.length > 0) {
    throw new Error(
      `${method.toUpperCase()} ${path} ${status} does not match the public contract: ${problems.join('; ')}: ${JSON.stringify(response.body)}`,
    );
  }
}

/**
 * Lists the problem examples of the public spec: every example of an `application/problem+json`
 * response, wherever it is declared.
 *
 * @returns The examples, with the pointer each comes from.
 */
export function problemExamples(): readonly { pointer: string; value: SpecNode }[] {
  const examples: { pointer: string; value: SpecNode }[] = [];
  const responses: SpecNode = nodeAt('/components/responses');
  for (const name of Object.keys(responses)) {
    const pointer = `/components/responses/${escapePointer(name)}/content/application~1problem+json`;
    const media: SpecNode | undefined = isNode(responses[name]) ? resolveMedia(pointer) : undefined;
    if (media === undefined) {
      continue;
    }
    if (isNode(media.example)) {
      examples.push({ pointer: `${pointer}/example`, value: media.example });
    }
    if (isNode(media.examples)) {
      for (const key of Object.keys(media.examples)) {
        const example: { pointer: string; node: SpecNode } = resolve(
          `${pointer}/examples/${escapePointer(key)}`,
        );
        if (isNode(example.node.value)) {
          examples.push({ pointer: `${example.pointer}/value`, value: example.node.value });
        }
      }
    }
  }
  return examples;
}

/**
 * Reads the problem media type of a response, when it has one.
 *
 * @param pointer - Pointer of the media type object.
 * @returns The media type object, or `undefined`.
 */
function resolveMedia(pointer: string): SpecNode | undefined {
  try {
    return nodeAt(pointer);
  } catch {
    return undefined;
  }
}
