import { ProblemException, type Problem } from '@cadenway/nest-common';
import { z } from 'zod';

import type { DocumentServiceClient } from '../../../../../../clients/document-service.client.js';
import type { DocumentsPort } from '../../../../application/ports/outbound/document-service/documents/documents.port.js';

type DocumentOperations = Pick<
  DocumentServiceClient,
  'listDocuments' | 'createDocument' | 'getDocument' | 'updateDocument' | 'deleteDocument'
>;

type Operation = 'read' | 'create' | 'conditional-write';

const documentProblemStatus = z.literal([400, 401, 403, 404, 409, 412, 422, 503]);

const clientProblemCodes: ReadonlySet<string> = new Set([
  'access.role-insufficient',
  'auth.actor-not-allowed',
  'auth.issuer-not-allowed',
  'auth.organization-required',
  'document.not-found',
  'idempotency.key-reused',
  'idempotency.request-in-progress',
  'organization.not-found',
  'request.body-too-large',
  'request.invalid',
  'request.version-mismatch',
  'space.not-found',
]);

const issuePaths: Readonly<Record<'body' | 'header' | 'param' | 'query', readonly string[]>> = {
  body: ['', 'body', 'spaceId', 'title'],
  header: ['Idempotency-Key', 'If-Match'],
  param: ['', 'documentId'],
  query: ['', 'cursor', 'limit', 'q'],
};

const documentIssue = z.object({
  in: z.enum(['body', 'header', 'param', 'query']),
  path: z.string(),
  code: z.enum([
    'custom',
    'invalid_cursor',
    'invalid_format',
    'invalid_json',
    'invalid_type',
    'too_big',
    'too_small',
    'unrecognized_keys',
    'unrecognized_parameter',
  ]),
});

/** Projects validation identifiers and replaces any explanation returned by the owner. */
function safeIssues(issues: readonly unknown[]): Problem['details'] {
  const validated = issues.flatMap((issue) => {
    const parsed = documentIssue.safeParse(issue);
    if (!parsed.success || !issuePaths[parsed.data.in].includes(parsed.data.path)) return [];
    return [{ ...parsed.data, message: 'Invalid value.' }];
  });
  return validated.length === 0 ? undefined : { issues: validated };
}

/** Keeps only detail members that the public operation defines. */
function publicDetails(problem: Problem, operation: Operation): Problem['details'] {
  const { status, code, details } = problem;
  if (details === undefined) return undefined;
  if (status === 400 && code === 'request.invalid' && Array.isArray(details.issues)) {
    return safeIssues(details.issues);
  }
  if (
    operation !== 'read' &&
    status === 403 &&
    code === 'access.role-insufficient' &&
    details.requiredRole === 'edit' &&
    (details.role === 'view' || details.role === 'comment')
  ) {
    return { role: details.role, requiredRole: 'edit' };
  }
  if (
    operation === 'conditional-write' &&
    status === 412 &&
    code === 'request.version-mismatch' &&
    typeof details.version === 'number' &&
    Number.isSafeInteger(details.version) &&
    details.version > 0
  ) {
    return { version: details.version };
  }
  return undefined;
}

/** Prevents upstream problem text and details from reaching the public error filter or its logs. */
async function documentAnswer<T>(call: Promise<T>, operation: Operation): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (!(error instanceof ProblemException)) throw error;
    const status = documentProblemStatus.safeParse(error.problem.status);
    if (!status.success) {
      throw new ProblemException({ status: 503, code: 'upstream.failed' });
    }
    // The shared transport owns 503 codes and only accepts explicitly configured owner codes.
    const { code } = error.problem;
    throw new ProblemException({
      status: status.data,
      code: status.data === 503 || clientProblemCodes.has(code) ? code : 'upstream.error',
      details: publicDetails(error.problem, operation),
    });
  }
}

/** Binds document operations to the signed client without changing keys, cursors or versions. */
export function createDocumentRegistryAdapter(client: DocumentOperations): DocumentsPort {
  return {
    list: (query) => documentAnswer(client.listDocuments(query), 'read'),
    create: (body, key) => documentAnswer(client.createDocument(body, key), 'create'),
    get: (id) => documentAnswer(client.getDocument(id), 'read'),
    update: (id, body, ifMatch) =>
      documentAnswer(client.updateDocument(id, body, ifMatch), 'conditional-write'),
    remove: (id, ifMatch) =>
      documentAnswer(client.deleteDocument(id, ifMatch), 'conditional-write'),
  };
}
