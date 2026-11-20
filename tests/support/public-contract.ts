import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import ajvModule, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import ajvFormatsModule from 'ajv-formats';
import type request from 'supertest';
import { parse } from 'yaml';

/**
 * A node of a parsed spec.
 */
export type SpecNode = Readonly<Record<string, unknown>>;

/**
 * Method of a public route, as the specs write it.
 */
export type SpecMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * The public specs the gateway serves, by file name.
 */
export const PUBLIC_SPEC_NAMES: readonly string[] = [
  'auth.yaml',
  'organizations.yaml',
  'members.yaml',
  'api-tokens.yaml',
  'spaces.yaml',
  'lists.yaml',
  'tasks.yaml',
  'time.yaml',
  'goals.yaml',
  'reports.yaml',
  'intake.yaml',
  'realtime.yaml',
  'access.yaml',
  'archives.yaml',
  'trash.yaml',
];

/**
 * A public spec as the installed `@cadenway/contracts` ships it, bundled into one file: the routes
 * are checked against the contract the gateway depends on, never a sibling checkout.
 */
export interface PublicSpec {
  /** File name, such as `members.yaml`, also its id in Ajv. */
  readonly name: string;
  /** The parsed spec. */
  readonly document: SpecNode;
}

/**
 * Resolves files of the installed packages.
 */
const resolvePackage: NodeJS.Require = createRequire(import.meta.url);

/**
 * The parsed public specs.
 */
export const PUBLIC_SPECS: readonly PublicSpec[] = PUBLIC_SPEC_NAMES.map((name: string) => ({
  name,
  document: parse(
    readFileSync(
      resolvePackage.resolve(`@cadenway/contracts/specs/openapi/public/${name}`),
      'utf8',
    ),
  ) as SpecNode,
}));

/**
 * Path of `openapi/public/auth.yaml` as the installed `@cadenway/contracts` ships it.
 */
export const PUBLIC_AUTH_SPEC_PATH: string = resolvePackage.resolve(
  '@cadenway/contracts/specs/openapi/public/auth.yaml',
);

/**
 * Ajv for JSON Schema 2020-12, the dialect of OpenAPI 3.1, with the formats the specs use
 * (`email`, `uuid`, `date-time`, `uri`, `uri-reference`). `strict: false` lets the OpenAPI
 * keywords (`x-extensible-enum`, `example`) through without failing.
 */
const ajv = new ajvModule.default({ strict: false, allErrors: true });
ajvFormatsModule.default(ajv);
for (const spec of PUBLIC_SPECS) {
  ajv.addSchema(spec.document, spec.name);
}

/**
 * Compiled validators, by spec and JSON pointer.
 */
const validators = new Map<string, ValidateFunction>();

/**
 * Narrows a value to an object node of a spec.
 *
 * @param value - Any value of a spec.
 * @returns Whether it is an object.
 */
export function isNode(value: unknown): value is SpecNode {
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
 * Reads the node at a JSON pointer of a spec.
 *
 * @param spec - The spec.
 * @param pointer - Pointer such as `/components/responses/SignedIn`.
 * @returns The node.
 */
function nodeAt(spec: PublicSpec, pointer: string): SpecNode {
  let node: unknown = spec.document;
  for (const segment of pointer.split('/').slice(1)) {
    const key: string = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    node = isNode(node) ? node[key] : undefined;
  }
  if (!isNode(node)) {
    throw new Error(`${spec.name} has no object at ${pointer}.`);
  }
  return node;
}

/**
 * Follows a local `$ref`, keeping the pointer of the node reached.
 *
 * @param spec - The spec.
 * @param pointer - Pointer of a node that may be a reference.
 * @returns The pointer and the node it resolves to.
 */
export function resolveNode(
  spec: PublicSpec,
  pointer: string,
): { pointer: string; node: SpecNode } {
  const node: SpecNode = nodeAt(spec, pointer);
  const reference: unknown = node.$ref;
  if (typeof reference === 'string' && reference.startsWith('#/')) {
    return resolveNode(spec, reference.slice(1));
  }
  return { pointer, node };
}

/**
 * Validates a value against the schema at a pointer of a spec.
 *
 * @param spec - The spec.
 * @param pointer - Pointer of the schema.
 * @param value - Value to validate.
 * @returns The errors, empty when the value is valid.
 */
function schemaErrors(spec: PublicSpec, pointer: string, value: unknown): readonly ErrorObject[] {
  const key = `${spec.name}#${pointer}`;
  let validate: ValidateFunction | undefined = validators.get(key);
  if (validate === undefined) {
    validate = ajv.compile({ $ref: key });
    validators.set(key, validate);
  }
  return validate(value) ? [] : (validate.errors ?? []);
}

/**
 * Finds the spec that declares a path.
 *
 * @param path - Path of the route, as the spec writes it.
 * @returns The spec.
 */
export function specOf(path: string): PublicSpec {
  const spec: PublicSpec | undefined = PUBLIC_SPECS.find((candidate: PublicSpec) => {
    const paths: unknown = candidate.document.paths;
    return isNode(paths) && path in paths;
  });
  if (spec === undefined) {
    throw new Error(`No public spec declares ${path}.`);
  }
  return spec;
}

/**
 * Lists the statuses an operation of the public specs declares.
 *
 * @param method - Method of the route.
 * @param path - Path of the route, as the spec writes it.
 * @returns The declared statuses.
 */
export function declaredStatuses(method: SpecMethod, path: string): readonly number[] {
  const responses: SpecNode = nodeAt(
    specOf(path),
    `/paths/${escapePointer(path)}/${method}/responses`,
  );
  return Object.keys(responses).map(Number);
}

/**
 * Checks a response of the gateway against its operation in the public specs: the status is one
 * the operation declares, the media type and the body match the declared content (the shared
 * problem schema for an error), a response without content has no body, and every header the
 * response declares (`Set-Cookie`, `Retry-After`, `ETag`, `Location`) is present.
 *
 * @param method - Method of the route.
 * @param path - Path of the route, as the spec writes it.
 * @param response - Response of supertest.
 * @throws {Error} Naming every mismatch.
 */
export function expectPublicResponse(
  method: SpecMethod,
  path: string,
  response: request.Response,
): void {
  const spec: PublicSpec = specOf(path);
  const operation = `/paths/${escapePointer(path)}/${method}`;
  const responses: SpecNode = nodeAt(spec, `${operation}/responses`);
  const status = String(response.status);
  if (!(status in responses)) {
    throw new Error(
      `${method.toUpperCase()} ${path} answered ${status}, which the public contract does not declare (${Object.keys(responses).join(', ')}): ${JSON.stringify(response.body)}`,
    );
  }
  const declared: { pointer: string; node: SpecNode } = resolveNode(
    spec,
    `${operation}/responses/${status}`,
  );
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
        spec,
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
 * Lists the problem examples of the public specs: every example of an `application/problem+json`
 * response declared under `components/responses`, in every spec.
 *
 * @returns The examples, with the spec and pointer each comes from.
 */
export function problemExamples(): readonly { pointer: string; value: SpecNode }[] {
  const examples: { pointer: string; value: SpecNode }[] = [];
  for (const spec of PUBLIC_SPECS) {
    const responses: SpecNode = nodeAt(spec, '/components/responses');
    for (const name of Object.keys(responses)) {
      const pointer = `/components/responses/${escapePointer(name)}/content/application~1problem+json`;
      const media: SpecNode | undefined = isNode(responses[name])
        ? resolveMedia(spec, pointer)
        : undefined;
      if (media === undefined) {
        continue;
      }
      if (isNode(media.example)) {
        examples.push({ pointer: `${spec.name}#${pointer}/example`, value: media.example });
      }
      if (isNode(media.examples)) {
        for (const key of Object.keys(media.examples)) {
          const example: { pointer: string; node: SpecNode } = resolveNode(
            spec,
            `${pointer}/examples/${escapePointer(key)}`,
          );
          if (isNode(example.node.value)) {
            examples.push({
              pointer: `${spec.name}#${example.pointer}/value`,
              value: example.node.value,
            });
          }
        }
      }
    }
  }
  return examples;
}

/**
 * Reads the problem media type of a response, when it has one.
 *
 * @param spec - The spec.
 * @param pointer - Pointer of the media type object.
 * @returns The media type object, or `undefined`.
 */
function resolveMedia(spec: PublicSpec, pointer: string): SpecNode | undefined {
  try {
    return nodeAt(spec, pointer);
  } catch {
    return undefined;
  }
}

/**
 * Reads the example of a JSON response of a public operation, as the contract shows it.
 *
 * @param method - Method of the operation.
 * @param path - Path of the operation, as the spec writes it.
 * @param status - Status of the response.
 * @returns The example.
 * @throws When the response declares no JSON example.
 */
export function responseExample(method: SpecMethod, path: string, status: number): unknown {
  const declared: { pointer: string; node: SpecNode } = resolveNode(
    specOf(path),
    `/paths/${escapePointer(path)}/${method}/responses/${String(status)}`,
  );
  const content: unknown = declared.node.content;
  const media: unknown = isNode(content) ? content['application/json'] : undefined;
  if (isNode(media) && media.example !== undefined) {
    return media.example;
  }
  const first: unknown =
    isNode(media) && isNode(media.examples) ? Object.values(media.examples)[0] : undefined;
  const reference: unknown = isNode(first) ? first.$ref : undefined;
  const named: unknown =
    typeof reference === 'string'
      ? resolveNode(specOf(path), reference.slice(1)).node.value
      : isNode(first)
        ? first.value
        : undefined;
  if (named === undefined) {
    throw new Error(`${method.toUpperCase()} ${path} ${String(status)} shows no JSON example.`);
  }
  return named;
}

/**
 * Lists the problem codes a public operation declares for one status: the codes its response
 * names in backquotes in its description and the codes of its examples, `details.*` members
 * excluded.
 *
 * @param method - Method of the operation.
 * @param path - Path of the operation, as the spec writes it.
 * @param status - Status of the response.
 * @returns The codes, each once; none when the status is not declared.
 */
export function declaredProblemCodes(
  method: SpecMethod,
  path: string,
  status: number,
): readonly string[] {
  const spec: PublicSpec = specOf(path);
  const responses: SpecNode = nodeAt(spec, `/paths/${escapePointer(path)}/${method}/responses`);
  if (!(String(status) in responses)) {
    return [];
  }
  const pointer = `/paths/${escapePointer(path)}/${method}/responses/${String(status)}`;
  const declared: SpecNode = resolveNode(spec, pointer).node;
  const codes: Set<string> = new Set<string>();
  const description: unknown = declared.description;
  if (typeof description === 'string') {
    for (const match of description.matchAll(/`([a-z][a-z-]*\.[a-z][a-z-]*)`/gu)) {
      if (match[1] !== undefined && !match[1].startsWith('details.')) {
        codes.add(match[1]);
      }
    }
  }
  const media: SpecNode | undefined = resolveMedia(
    spec,
    `${resolveNode(spec, pointer).pointer}/content/application~1problem+json`,
  );
  const values: unknown[] = [];
  if (media !== undefined && isNode(media.example)) {
    values.push(media.example);
  }
  if (media !== undefined && isNode(media.examples)) {
    for (const example of Object.values(media.examples)) {
      const reference: unknown = isNode(example) ? example.$ref : undefined;
      const node: unknown =
        typeof reference === 'string'
          ? resolveNode(spec, reference.slice(1)).node.value
          : undefined;
      values.push(node ?? (isNode(example) ? example.value : undefined));
    }
  }
  for (const value of values) {
    if (isNode(value) && typeof value.code === 'string') {
      codes.add(value.code);
    }
  }
  return [...codes];
}
