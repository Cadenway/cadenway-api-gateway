import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  ProblemException,
  runWithDeadline,
  runWithOrganizationContext,
  type Ed25519PrivateJwk,
  type InternalPrincipal,
  type OrganizationContext,
} from '@cadenway/nest-common';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';

import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer, type SetupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import {
  createFakeTask,
  taskDetailCore,
  type FakeTask,
  type TaskServiceMethod,
} from '../../tests/support/fake-task.js';
import { responseExample, type SpecMethod } from '../../tests/support/public-contract.js';
import {
  GATEWAY_ISSUER,
  generateSigningKeys,
  type SigningKeys,
} from '../../tests/support/test-environment.js';
import { TASK_SERVICE, TaskServiceClient } from './task-service.client.js';

/**
 * Base URL of the faked task-service.
 */
const BASE_URL = 'http://task-service.test';

/**
 * Camille in Atelier Nord, the context of the calls.
 */
const CAMILLE_IN_ATELIER_NORD: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: ['tasks:read', 'tasks:write'],
};

/**
 * Ids of the space, the list, the access request, the trash entry and the checklist item of the
 * calls.
 */
const SPACE_ID = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const LIST_ID = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
const ACCESS_REQUEST_ID = '019a7e00-1a2b-7c3d-8e4f-5a6b7c8d9e21';
const ENTRY_ID = '019a7f00-1a2b-7c3d-8e4f-5a6b7c8d9e31';
const ITEM_ID = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e10';
const NATIVE_EXPORT_ROWS = 256;
const NATIVE_EXPORT_HEADER_TIMEOUT = 1000;

/** Writes a chunked export through Node's real socket backpressure. */
async function serveNativeExport(response: ServerResponse): Promise<number> {
  const closed = new AbortController();
  const onClose = (): void => {
    closed.abort();
  };
  response.once('close', onClose);
  let drains = 0;
  const writeRecord = async (record: object): Promise<void> => {
    const chunk = Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
    if (!response.write(chunk)) {
      drains += 1;
      await once(response, 'drain', { signal: closed.signal });
    }
  };

  try {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    await writeRecord({ kind: 'metadata', filename: 'sprint.csv', header: '"Identifiant"' });
    // Cross the ordinary header deadline while the response body is still open.
    await delay(NATIVE_EXPORT_HEADER_TIMEOUT + 200, undefined, { signal: closed.signal });

    const afterAssignees = ['""', '""', ...Array<string>(30).fill(`"${'界'.repeat(500)}"`)];
    for (let index = 1; index <= NATIVE_EXPORT_ROWS; index += 1) {
      await writeRecord({
        kind: 'row',
        row: {
          beforeAssignees: [`"CAD-${String(index)}"`, '"Nom"', '"En cours"', '"Haute"'],
          assigneeIds: [],
          afterAssignees,
        },
      });
    }
    await writeRecord({ kind: 'complete', rowCount: NATIVE_EXPORT_ROWS });
    response.end();
    return drains;
  } finally {
    response.off('close', onClose);
  }
}

it('reads a signed CSV projection under socket backpressure beyond the header deadline', async () => {
  const keys = generateSigningKeys();
  const signer = await InternalTokenSigner.create({
    issuer: GATEWAY_ISSUER,
    privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
  });
  const verifier = await InternalTokenVerifier.create({
    audience: TASK_SERVICE,
    trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
  });
  const requestSignal = new AbortController();
  const writes: Promise<number>[] = [];
  let principal: InternalPrincipal | undefined;
  let propagatedBudget: number | undefined;
  const producer = createServer({ highWaterMark: 16_384 }, (request, response) => {
    const served = (async (): Promise<number> => {
      expect(request.method).toBe('GET');
      expect(request.url?.split('?')[0]).toBe(`/internal/v1/lists/${LIST_ID}/tasks/export`);
      expect(request.headers.accept).toBe('application/x-ndjson');
      propagatedBudget = Number(request.headers['x-request-timeout-ms']);
      principal = await verifier.verify(
        (request.headers.authorization ?? '').replace(/^Bearer /u, ''),
      );
      return serveNativeExport(response);
    })();
    writes.push(served);
    void served.catch(() => {
      response.destroy();
    });
  });

  try {
    producer.listen(0, '127.0.0.1');
    await once(producer, 'listening');
    const address = producer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The loopback server did not obtain a TCP port.');
    }
    const client = new TaskServiceClient(
      new InternalHttpClient({
        service: TASK_SERVICE,
        baseUrl: `http://127.0.0.1:${String(address.port)}`,
        signer,
        callTimeoutMs: NATIVE_EXPORT_HEADER_TIMEOUT,
      }),
    );
    const observedKeys: string[] = [];
    let observedCompletion: number | undefined;
    let firstFrame: string | undefined;

    await runWithDeadline(10_000, () =>
      runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, async () => {
        const records = await client.exportListTasks(LIST_ID, {}, requestSignal.signal);
        for await (const record of records) {
          firstFrame ??= record.kind;
          if (record.kind === 'row') {
            observedKeys.push(record.row.beforeAssignees[0] ?? '');
            expect(record.row.afterAssignees[31]).toBe(`"${'界'.repeat(500)}"`);
            if (observedKeys.length % 32 === 0) await delay(10);
          } else if (record.kind === 'complete') {
            observedCompletion = record.rowCount;
          }
        }
      }),
    );

    expect(writes).toHaveLength(1);
    expect((await Promise.all(writes))[0]).toBeGreaterThan(0);
    expect(firstFrame).toBe('metadata');
    expect(observedKeys).toEqual(
      Array.from({ length: NATIVE_EXPORT_ROWS }, (_, index) => `"CAD-${String(index + 1)}"`),
    );
    expect(observedCompletion).toBe(NATIVE_EXPORT_ROWS);
    expect(propagatedBudget).toBeGreaterThan(NATIVE_EXPORT_HEADER_TIMEOUT);
    expect(principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
      scopes: ['tasks:read', 'tasks:write'],
    });
  } finally {
    requestSignal.abort();
    producer.closeAllConnections();
    await new Promise<void>((resolve) => {
      producer.close(() => {
        resolve();
      });
    });
  }
});

describe('Task notification visibility', () => {
  let signer: InternalTokenSigner;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
  });

  it('rejects missing display, mismatched task and missing no-store', async () => {
    let result: unknown = { results: [{ visible: true }] };
    let cache = 'no-store';
    let upstreamSignal: AbortSignal | null | undefined;
    const cancellation = new AbortController();
    const client = new TaskServiceClient(
      new InternalHttpClient({
        service: TASK_SERVICE,
        baseUrl: 'http://task-service.test',
        signer,
        fetch: (_input, init) => {
          upstreamSignal = init?.signal;
          return Promise.resolve(Response.json(result, { headers: { 'Cache-Control': cache } }));
        },
      }),
    );
    const request = {
      subjects: [{ subject: { kind: 'task-key' as const, taskKey: 'CAD-482' }, display: {} }],
    };
    const call = () =>
      runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, () =>
        client.resolveNotificationSubjects(request, cancellation.signal),
      );

    await expect(call()).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
    result = {
      results: [
        {
          visible: true,
          display: {
            taskId: '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23',
            taskKey: 'CAD-1',
            taskName: 'Wrong task',
          },
        },
      ],
    };
    await expect(call()).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
    result = { results: [{ visible: false }] };
    cache = 'public';
    await expect(call()).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
    cache = 'no-store';
    await expect(call()).resolves.toEqual(result);
    expect(upstreamSignal?.aborted).toBe(false);
    cancellation.abort();
    expect(upstreamSignal?.aborted).toBe(true);
  });
});

/**
 * A call task-service received.
 */
interface ReceivedCall {
  // #region Properties
  /** HTTP method. */
  readonly method: string;

  /** Path and query, decoded. */
  readonly url: string;

  /** Parsed JSON body, `undefined` without one. */
  readonly body: unknown;

  /** `If-Match`, or `null`. */
  readonly ifMatch: string | null;

  /** `Idempotency-Key`, or `null`. */
  readonly idempotencyKey: string | null;

  /** The verified internal token. */
  readonly principal: InternalPrincipal;
  // #endregion
}

/**
 * A change the client sends to task-service.
 */
interface Change {
  // #region Properties
  /** Name of the method of the client. */
  readonly name: string;

  /** HTTP method of the internal route. */
  readonly method: 'post' | 'put' | 'patch' | 'delete';

  /** Internal path the change is sent to. */
  readonly path: string;

  /** Whether the method relays an `If-Match`. */
  readonly conditional: boolean;

  /** Sends the change through `client`, with `ifMatch` when the method relays one. */
  readonly send: (client: TaskServiceClient, ifMatch: string | undefined) => Promise<unknown>;
  // #endregion
}

/**
 * One change, sent with or without `If-Match`.
 */
interface ChangeCase extends Change {
  // #region Properties
  /** `If-Match` of the call, or none. */
  readonly ifMatch: string | undefined;

  /** Name of the case in the test title. */
  readonly label: string;
  // #endregion
}

/**
 * Every change of task-service the client sends but a creation with an `Idempotency-Key`.
 */
const CHANGES: readonly Change[] = [
  {
    name: 'createFavorite',
    method: 'post',
    path: '/internal/v1/me/favorites',
    conditional: false,
    send: (client) => client.createFavorite({ kind: 'list', targetId: LIST_ID }, 'favorite-key'),
  },
  {
    name: 'deleteFavorite',
    method: 'delete',
    path: '/internal/v1/me/favorites/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02',
    conditional: true,
    send: (client, ifMatch) =>
      client.deleteFavorite('019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02', ifMatch),
  },
  {
    name: 'createSavedView',
    method: 'post',
    path: `/internal/v1/lists/${LIST_ID}/saved-views`,
    conditional: false,
    send: (client) =>
      client.createSavedView(
        LIST_ID,
        {
          name: 'View',
          configuration: { layout: 'list', filters: {}, sort: 'dueDate', groupBy: null },
        },
        'view-key',
      ),
  },
  {
    name: 'updateSavedView',
    method: 'patch',
    path: `/internal/v1/lists/${LIST_ID}/saved-views/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01`,
    conditional: true,
    send: (client, ifMatch) =>
      client.updateSavedView(
        LIST_ID,
        '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01',
        { name: 'Changed' },
        ifMatch,
      ),
  },
  {
    name: 'deleteSavedView',
    method: 'delete',
    path: `/internal/v1/lists/${LIST_ID}/saved-views/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01`,
    conditional: true,
    send: (client, ifMatch) =>
      client.deleteSavedView(LIST_ID, '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01', ifMatch),
  },
  {
    name: 'duplicateSavedView',
    method: 'post',
    path: `/internal/v1/lists/${LIST_ID}/saved-views/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01/duplicate`,
    conditional: true,
    send: (client, ifMatch) =>
      client.duplicateSavedView(
        LIST_ID,
        '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01',
        {},
        ifMatch,
        'copy-key',
      ),
  },
  {
    name: 'createTaskTemplate',
    method: 'post',
    path: `/internal/v1/spaces/${SPACE_ID}/task-templates`,
    conditional: false,
    send: (client) =>
      client.createTaskTemplate(
        SPACE_ID,
        { sourceTaskKey: 'CAD-482', name: 'Template' },
        'template-key',
      ),
  },
  {
    name: 'deleteTaskTemplate',
    method: 'delete',
    path: `/internal/v1/spaces/${SPACE_ID}/task-templates/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01`,
    conditional: true,
    send: (client, ifMatch) =>
      client.deleteTaskTemplate(SPACE_ID, '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01', ifMatch),
  },
  {
    name: 'createTaskDependency',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/dependencies',
    conditional: true,
    send: (client, ifMatch) =>
      client.createTaskDependency(
        'CAD-482',
        { otherTaskKey: 'CAD-483', direction: 'blocks' },
        ifMatch,
        'edge-key',
      ),
  },
  {
    name: 'deleteTaskDependency',
    method: 'delete',
    path: '/internal/v1/tasks/CAD-482/dependencies/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01',
    conditional: true,
    send: (client, ifMatch) =>
      client.deleteTaskDependency('CAD-482', '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01', ifMatch),
  },
  {
    name: 'followTaskWatcher',
    method: 'put',
    path: `/internal/v1/tasks/CAD-482/watchers/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) => client.followTaskWatcher('CAD-482', CAMILLE.id, {}, ifMatch),
  },
  {
    name: 'unfollowTaskWatcher',
    method: 'delete',
    path: `/internal/v1/tasks/CAD-482/watchers/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) => client.unfollowTaskWatcher('CAD-482', CAMILLE.id, ifMatch),
  },
  {
    name: 'createTaskComment',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/comments',
    conditional: false,
    send: (client) => client.createTaskComment('CAD-482', { body: 'hello' }, 'key'),
  },
  {
    name: 'deleteTaskComment',
    method: 'delete',
    path: '/internal/v1/tasks/CAD-482/comments/019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01',
    conditional: true,
    send: (client, ifMatch) =>
      client.deleteTaskComment('CAD-482', '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01', ifMatch),
  },
  {
    name: 'duplicateList',
    method: 'post',
    path: `/internal/v1/lists/${LIST_ID}/duplicate`,
    conditional: true,
    send: (client, ifMatch) => client.duplicateList(LIST_ID, {}, ifMatch, 'copy-list'),
  },
  {
    name: 'duplicateTask',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/duplicate',
    conditional: true,
    send: (client, ifMatch) => client.duplicateTask('CAD-482', {}, ifMatch, 'copy-task'),
  },
  {
    name: 'executeBulkTaskAction',
    method: 'post',
    path: '/internal/v1/tasks/bulk-actions',
    conditional: false,
    send: (client) =>
      client.executeBulkTaskAction(
        { selection: [{ taskKey: 'CAD-482' }], action: { type: 'status', status: 'done' } },
        'bulk',
      ),
  },
  {
    name: 'updateSpace',
    method: 'patch',
    path: `/internal/v1/spaces/${SPACE_ID}`,
    conditional: true,
    send: (client, ifMatch) => client.updateSpace(SPACE_ID, { name: 'Produit' }, ifMatch),
  },
  {
    name: 'deleteSpace',
    method: 'delete',
    path: `/internal/v1/spaces/${SPACE_ID}`,
    conditional: true,
    send: (client, ifMatch) => client.deleteSpace(SPACE_ID, ifMatch),
  },
  {
    name: 'updateList',
    method: 'patch',
    path: `/internal/v1/lists/${LIST_ID}`,
    conditional: true,
    send: (client, ifMatch) => client.updateList(LIST_ID, { name: 'Sprint 14' }, ifMatch),
  },
  {
    name: 'deleteList',
    method: 'delete',
    path: `/internal/v1/lists/${LIST_ID}`,
    conditional: true,
    send: (client, ifMatch) => client.deleteList(LIST_ID, ifMatch),
  },
  {
    name: 'updateTask',
    method: 'patch',
    path: '/internal/v1/tasks/CAD-482',
    conditional: true,
    send: (client, ifMatch) => client.updateTask('CAD-482', { name: 'Renommée' }, ifMatch),
  },
  {
    name: 'updateChecklistItem',
    method: 'patch',
    path: `/internal/v1/tasks/CAD-482/checklist-items/${ITEM_ID}`,
    conditional: true,
    send: (client, ifMatch) =>
      client.updateChecklistItem('CAD-482', ITEM_ID, { done: true }, ifMatch),
  },
  {
    name: 'assignTask',
    method: 'put',
    path: `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) => client.assignTask('CAD-482', CAMILLE.id, ifMatch),
  },
  {
    name: 'unassignTask',
    method: 'delete',
    path: `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) => client.unassignTask('CAD-482', CAMILLE.id, ifMatch),
  },
  {
    name: 'addTaskLabel',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/labels/add',
    conditional: true,
    send: (client, ifMatch) => client.addTaskLabel('CAD-482', { name: 'Sécurité' }, ifMatch),
  },
  {
    name: 'removeTaskLabel',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/labels/remove',
    conditional: true,
    send: (client, ifMatch) => client.removeTaskLabel('CAD-482', { name: 'Front' }, ifMatch),
  },
  {
    name: 'setSpaceGrant',
    method: 'put',
    path: `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) =>
      client.setSpaceGrant(SPACE_ID, CAMILLE.id, { role: 'edit' }, ifMatch),
  },
  {
    name: 'removeSpaceGrant',
    method: 'delete',
    path: `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) => client.removeSpaceGrant(SPACE_ID, CAMILLE.id, ifMatch),
  },
  {
    name: 'setListGrant',
    method: 'put',
    path: `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) =>
      client.setListGrant(LIST_ID, CAMILLE.id, { role: 'comment' }, ifMatch),
  },
  {
    name: 'removeListGrant',
    method: 'delete',
    path: `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
    conditional: true,
    send: (client, ifMatch) => client.removeListGrant(LIST_ID, CAMILLE.id, ifMatch),
  },
  {
    name: 'createAccessRequest',
    method: 'post',
    path: '/internal/v1/access-requests',
    conditional: false,
    send: (client) => client.createAccessRequest({ spaceId: SPACE_ID }),
  },
  {
    name: 'approveAccessRequest',
    method: 'post',
    path: `/internal/v1/access-requests/${ACCESS_REQUEST_ID}/approval`,
    conditional: false,
    send: (client) => client.approveAccessRequest(ACCESS_REQUEST_ID, { role: 'view' }),
  },
  {
    name: 'refuseAccessRequest',
    method: 'post',
    path: `/internal/v1/access-requests/${ACCESS_REQUEST_ID}/refusal`,
    conditional: false,
    send: (client) => client.refuseAccessRequest(ACCESS_REQUEST_ID, {}),
  },
  {
    name: 'archiveList',
    method: 'post',
    path: `/internal/v1/lists/${LIST_ID}/archive`,
    conditional: true,
    send: (client, ifMatch) => client.archiveList(LIST_ID, {}, ifMatch),
  },
  {
    name: 'unarchiveList',
    method: 'post',
    path: `/internal/v1/lists/${LIST_ID}/unarchive`,
    conditional: true,
    send: (client, ifMatch) => client.unarchiveList(LIST_ID, {}, ifMatch),
  },
  {
    name: 'archiveTask',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/archive',
    conditional: true,
    send: (client, ifMatch) => client.archiveTask('CAD-482', {}, ifMatch),
  },
  {
    name: 'unarchiveTask',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/unarchive',
    conditional: true,
    send: (client, ifMatch) => client.unarchiveTask('CAD-482', {}, ifMatch),
  },
  {
    name: 'trashTask',
    method: 'post',
    path: '/internal/v1/tasks/CAD-482/trash',
    conditional: true,
    send: (client, ifMatch) => client.trashTask('CAD-482', {}, ifMatch),
  },
  {
    name: 'purgeTrashEntry',
    method: 'delete',
    path: `/internal/v1/trash/entries/${ENTRY_ID}`,
    conditional: false,
    send: (client) => client.purgeTrashEntry(ENTRY_ID),
  },
  {
    name: 'restoreTrashEntry',
    method: 'post',
    path: `/internal/v1/trash/entries/${ENTRY_ID}/restore`,
    conditional: false,
    send: (client) => client.restoreTrashEntry(ENTRY_ID, {}, {}),
  },
  {
    name: 'emptyTrash',
    method: 'post',
    path: '/internal/v1/trash/empty',
    conditional: false,
    send: (client) => client.emptyTrash({}),
  },
];

/**
 * Every change, without `If-Match`, then with one when its method relays it.
 */
const CHANGE_CASES: readonly ChangeCase[] = CHANGES.flatMap((change: Change) =>
  (change.conditional ? [undefined, '"3"'] : [undefined]).map((ifMatch: string | undefined) => ({
    ...change,
    ifMatch,
    label: `${change.name} ${ifMatch === undefined ? 'without' : 'with'} If-Match`,
  })),
);

/**
 * The failures after which the internal HTTP client retries an idempotent call: what task-service
 * answers, then the code the call is rejected with when it is not retried.
 */
const RETRYABLE_FAILURES: readonly (readonly [string, () => Response, string])[] = [
  ['a connection error', () => HttpResponse.error(), 'upstream.unreachable'],
  [
    'a 503',
    () =>
      HttpResponse.json(
        { type: 'about:blank', status: 503, code: 'service.unavailable' },
        {
          status: 503,
        },
      ),
    'upstream.unavailable',
  ],
];

describe('TaskServiceClient against task-service over HTTP', () => {
  const server: SetupServer = setupServer();
  let verifier: InternalTokenVerifier;
  let signer: InternalTokenSigner;
  let calls: ReceivedCall[];
  let client: TaskServiceClient;

  /**
   * Answers every call of one method and path with what `reply` builds, recording the call.
   *
   * @param method - Method to answer.
   * @param path - Path to answer, from `/internal`.
   * @param reply - The answer.
   */
  function answer(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    reply: (request: Request) => Response,
  ): void {
    server.use(
      http[method](`${BASE_URL}${path}`, async ({ request }) => {
        const text: string = await request.text();
        const url: URL = new URL(request.url);
        calls.push({
          method: request.method,
          url: decodeURIComponent(`${url.pathname}${url.search}`),
          body: text === '' ? undefined : (JSON.parse(text) as unknown),
          ifMatch: request.headers.get('If-Match'),
          idempotencyKey: request.headers.get('Idempotency-Key'),
          principal: await verifier.verify(
            (request.headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
          ),
        });
        return reply(request);
      }),
    );
  }

  /**
   * Builds a JSON answer.
   *
   * @param body - The body.
   * @param status - The status.
   * @param headers - Further headers.
   * @returns The answer.
   */
  function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return HttpResponse.json(body as JsonBodyType, { status, headers });
  }

  /**
   * Runs a call as Camille in Atelier Nord.
   *
   * @param call - The call.
   * @returns What the call resolved with.
   */
  function asCamille<TResult>(call: () => Promise<TResult>): Promise<TResult> {
    return runWithOrganizationContext(CAMILLE_IN_ATELIER_NORD, call);
  }

  /**
   * Builds a client with its own internal HTTP client, hence its own circuit breaker.
   *
   * @returns The client.
   */
  function newClient(): TaskServiceClient {
    return new TaskServiceClient(
      new InternalHttpClient({ service: TASK_SERVICE, baseUrl: BASE_URL, signer }),
    );
  }

  beforeAll(async () => {
    server.listen({ onUnhandledFrame: 'error' });
    const keys: SigningKeys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: TASK_SERVICE,
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
  });

  beforeEach(() => {
    calls = [];
    // Built after `listen`: the internal HTTP client takes the `fetch` msw intercepts.
    client = newClient();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('reads a task with an internal token for task-service carrying the user and the organization', async () => {
    const task: unknown = responseExample('get', '/v1/tasks/{taskKey}', 200);
    answer('get', '/internal/v1/tasks/CAD-482', () => json(task));

    await expect(asCamille(() => client.getTask('CAD-482'))).resolves.toEqual(task);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
  });

  it('opens an NDJSON export through the generated route with the verified user and organization', async () => {
    const frames = [
      { kind: 'metadata', filename: 'sprint.csv', header: '"Identifiant"' },
      { kind: 'complete', rowCount: 0 },
    ];
    answer('get', '/internal/v1/lists/:listId/tasks/export', (request) => {
      expect(request.headers.get('Accept')).toBe('application/x-ndjson');
      return new HttpResponse(`${frames.map((frame) => JSON.stringify(frame)).join('\n')}\n`, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      });
    });

    const stream = await asCamille(() =>
      client.exportListTasks(LIST_ID, { sheetSortColumn: 'people' }),
    );

    const result: unknown[] = [];
    for await (const frame of stream) result.push(frame);

    expect(result).toEqual(frames);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('sheetSortColumn=people');
    expect(calls[0]?.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
  });

  it('does not retry an unavailable export', async () => {
    answer('get', '/internal/v1/lists/:listId/tasks/export', () =>
      json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503),
    );

    await expect(asCamille(() => client.exportListTasks(LIST_ID, {}))).rejects.toBeInstanceOf(
      ProblemException,
    );
    expect(calls).toHaveLength(1);
  });

  it('retains a typed row-limit refusal before handing off an export body', async () => {
    answer('get', '/internal/v1/lists/:listId/tasks/export', () =>
      json(
        {
          type: 'about:blank',
          title: 'Export too large',
          status: 422,
          code: 'list.export-row-limit-reached',
        },
        422,
        { 'Content-Type': 'application/problem+json' },
      ),
    );

    await expect(asCamille(() => client.exportListTasks(LIST_ID, {}))).rejects.toMatchObject({
      problem: { status: 422, code: 'list.export-row-limit-reached' },
    });
    expect(calls).toHaveLength(1);
  });

  it('uses an unscoped system token for public intake submissions and forwards the replay key', async () => {
    const key = 'A'.repeat(43);
    answer('post', '/internal/v1/intake-forms/:publicKey/submissions', () =>
      json({ receipt: 'B'.repeat(43) }),
    );

    await client.submitPublicIntakeForm(key, { title: 'Aide' }, 'request-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.idempotencyKey).toBe('request-1');
    expect(calls[0]?.principal).toMatchObject({
      actor: { type: 'system', id: null },
      organizationId: null,
    });
  });

  it('does not retry a public intake submission even when it has a replay key', async () => {
    const key = 'A'.repeat(43);
    answer('post', '/internal/v1/intake-forms/:publicKey/submissions', () =>
      json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503),
    );

    await expect(
      client.submitPublicIntakeForm(key, { title: 'Aide' }, 'request-1'),
    ).rejects.toBeInstanceOf(ProblemException);
    expect(calls).toHaveLength(1);
  });

  it('returns the intake ETag on a no-content publication revocation', async () => {
    answer(
      'delete',
      '/internal/v1/lists/:listId/intake-form/publication',
      () => new HttpResponse(null, { status: 204, headers: { ETag: '"3"' } }),
    );

    await expect(asCamille(() => client.disableIntakeForm(LIST_ID, '"2"'))).resolves.toBe(3);
    expect(calls[0]?.ifMatch).toBe('"2"');
  });

  it('sends the array filters comma-separated and every other parameter as declared', async () => {
    answer('get', '/internal/v1/lists/:listId/tasks', () =>
      json(responseExample('get', '/v1/lists/{listId}/tasks', 200)),
    );

    await asCamille(() =>
      client.listTasks('019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12', {
        status: ['progress', 'review'],
        assignee: ['me'],
        level: 'roots',
        sort: 'manual',
        limit: 10,
      }),
    );

    expect(calls[0]?.url).toBe(
      '/internal/v1/lists/019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12/tasks?status=progress,review&assignee=me&level=roots&sort=manual&limit=10',
    );
  });

  it('relays the today of the caller and the user of the context on the home', async () => {
    answer('get', '/internal/v1/users/:userId/home', () =>
      json(responseExample('get', '/v1/me/home', 200)),
    );

    await asCamille(() => client.getHome(CAMILLE.id, { today: '2026-11-18' }));

    expect(calls[0]?.url).toBe(`/internal/v1/users/${CAMILLE.id}/home?today=2026-11-18`);
  });

  it('retries a task creation with Idempotency-Key after a 503', async () => {
    let attempts = 0;
    answer('post', '/internal/v1/lists/:listId/tasks', () => {
      attempts += 1;
      return attempts === 1
        ? json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503)
        : json(responseExample('post', '/v1/lists/{listId}/tasks', 201), 201);
    });
    await asCamille(() => client.createTask(LIST_ID, { name: 'Tester' }, 'creation-1'));
    expect(calls.map((call: ReceivedCall) => call.idempotencyKey)).toEqual([
      'creation-1',
      'creation-1',
    ]);
  });

  it('forwards a bulk action and its idempotency key and validates the response', async () => {
    const action = {
      selection: [{ taskKey: 'CAD-482', version: 12 }],
      action: { type: 'status', status: 'done' },
    };
    answer('post', '/internal/v1/tasks/bulk-actions', () =>
      json({
        results: [{ taskKey: 'CAD-482', version: 13, privateField: 'ignored' }],
        affectedCount: 1,
        extra: true,
      }),
    );
    await expect(
      asCamille(() => client.executeBulkTaskAction(action, 'bulk-key')),
    ).resolves.toEqual({ results: [{ taskKey: 'CAD-482', version: 13 }], affectedCount: 1 });
    expect(calls[0]?.idempotencyKey).toBe('bulk-key');
    expect(calls[0]?.body).toEqual(action);
  });

  it('forwards favorite pagination and validates the page', async () => {
    answer('get', '/internal/v1/me/favorites', () =>
      json(responseExample('get', '/v1/me/favorites', 200)),
    );
    await asCamille(() => client.listFavorites({ cursor: 'page', limit: 12 }));
    expect(calls[0]?.url).toBe('/internal/v1/me/favorites?cursor=page&limit=12');
  });

  it('checks favorite creation location and version and forwards the idempotency key', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02';
    answer('post', '/internal/v1/me/favorites', () =>
      json(responseExample('post', '/v1/me/favorites', 201), 201, {
        ETag: '"1"',
        Location: `/internal/v1/me/favorites/${id}`,
      }),
    );
    await asCamille(() =>
      client.createFavorite({ kind: 'list', targetId: LIST_ID }, 'favorite-key'),
    );
    expect(calls[0]?.idempotencyKey).toBe('favorite-key');
  });

  it('checks a favorite read against its identity and version', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02';
    answer('get', `/internal/v1/me/favorites/${id}`, () =>
      json(responseExample('post', '/v1/me/favorites', 201), 200, { ETag: '"1"' }),
    );
    await expect(asCamille(() => client.getFavorite(id))).resolves.toMatchObject({
      id,
      version: 1,
    });
  });

  it.each([
    [
      'missing ETag',
      { Location: '/internal/v1/me/favorites/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02' },
    ],
    [
      'wrong Location',
      { ETag: '"1"', Location: '/internal/v1/me/favorites/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01' },
    ],
  ])('rejects favorite creation with %s', async (_reason, headers) => {
    answer('post', '/internal/v1/me/favorites', () =>
      json(responseExample('post', '/v1/me/favorites', 201), 201, headers),
    );
    await expect(
      asCamille(() => client.createFavorite({ kind: 'list', targetId: LIST_ID }, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('rejects a favorite read whose identity differs from the request', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    answer('get', `/internal/v1/me/favorites/${id}`, () =>
      json(responseExample('post', '/v1/me/favorites', 201), 200, { ETag: '"1"' }),
    );
    await expect(asCamille(() => client.getFavorite(id))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('forwards saved view pagination and validates the page', async () => {
    answer('get', `/internal/v1/lists/${LIST_ID}/saved-views`, () =>
      json(responseExample('get', '/v1/lists/{listId}/saved-views', 200)),
    );
    await asCamille(() => client.listSavedViews(LIST_ID, { cursor: 'page', limit: 12 }));
    expect(calls[0]?.url).toBe(`/internal/v1/lists/${LIST_ID}/saved-views?cursor=page&limit=12`);
  });

  it('creates and duplicates saved views with validated locations and request headers', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    const copy = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f03';
    answer('post', `/internal/v1/lists/${LIST_ID}/saved-views`, () =>
      json(responseExample('post', '/v1/lists/{listId}/saved-views', 201), 201, {
        ETag: '"1"',
        Location: `/internal/v1/lists/${LIST_ID}/saved-views/${id}`,
      }),
    );
    answer('post', `/internal/v1/lists/${LIST_ID}/saved-views/${id}/duplicate`, () =>
      json(responseExample('post', '/v1/lists/{listId}/saved-views/{viewId}/duplicate', 201), 201, {
        ETag: '"1"',
        Location: `/internal/v1/lists/${LIST_ID}/saved-views/${copy}`,
      }),
    );
    await asCamille(() =>
      client.createSavedView(
        LIST_ID,
        {
          name: 'View',
          configuration: { layout: 'list', filters: {}, sort: 'dueDate', groupBy: null },
        },
        'view-key',
      ),
    );
    await asCamille(() => client.duplicateSavedView(LIST_ID, id, {}, '"1"', 'copy-key'));
    expect(calls.map((item: ReceivedCall) => item.idempotencyKey)).toEqual([
      'view-key',
      'copy-key',
    ]);
    expect(calls[1]?.ifMatch).toBe('"1"');
  });

  it('validates view identity and ETag on reads and updates', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    const view = responseExample('get', '/v1/lists/{listId}/saved-views/{viewId}', 200);
    answer('get', `/internal/v1/lists/${LIST_ID}/saved-views/${id}`, () =>
      json(view, 200, { ETag: '"1"' }),
    );
    answer('patch', `/internal/v1/lists/${LIST_ID}/saved-views/${id}`, () =>
      json(view, 200, { ETag: '"1"' }),
    );
    await expect(asCamille(() => client.getSavedView(LIST_ID, id))).resolves.toMatchObject({
      id,
      version: 1,
    });
    await expect(
      asCamille(() => client.updateSavedView(LIST_ID, id, { name: 'Changed' }, '"1"')),
    ).resolves.toMatchObject({ id, version: 1 });
    expect(calls[1]?.ifMatch).toBe('"1"');
  });

  it('rejects a saved view returned for another list', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    const view = responseExample('get', '/v1/lists/{listId}/saved-views/{viewId}', 200);
    answer('get', `/internal/v1/lists/${LIST_ID}/saved-views/${id}`, () =>
      json(
        { ...(view as Record<string, unknown>), listId: '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f99' },
        200,
        { ETag: '"1"' },
      ),
    );
    await expect(asCamille(() => client.getSavedView(LIST_ID, id))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('rejects a saved view creation with an invalid Location', async () => {
    answer('post', `/internal/v1/lists/${LIST_ID}/saved-views`, () =>
      json(responseExample('post', '/v1/lists/{listId}/saved-views', 201), 201, {
        ETag: '"1"',
        Location: '/internal/v1/lists/wrong',
      }),
    );
    await expect(
      asCamille(() =>
        client.createSavedView(
          LIST_ID,
          {
            name: 'View',
            configuration: { layout: 'list', filters: {}, sort: 'dueDate', groupBy: null },
          },
          undefined,
        ),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('forwards template pagination and validates the page', async () => {
    answer('get', `/internal/v1/spaces/${SPACE_ID}/task-templates`, () =>
      json(responseExample('get', '/v1/spaces/{spaceId}/task-templates', 200)),
    );
    await asCamille(() => client.listTaskTemplates(SPACE_ID, { cursor: 'page', limit: 12 }));
    expect(calls[0]?.url).toBe(
      `/internal/v1/spaces/${SPACE_ID}/task-templates?cursor=page&limit=12`,
    );
  });

  it('checks template creation location and version while forwarding the idempotency key', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    answer('post', `/internal/v1/spaces/${SPACE_ID}/task-templates`, () =>
      json(responseExample('post', '/v1/spaces/{spaceId}/task-templates', 201), 201, {
        ETag: '"1"',
        Location: `/internal/v1/spaces/${SPACE_ID}/task-templates/${id}`,
      }),
    );
    await asCamille(() =>
      client.createTaskTemplate(
        SPACE_ID,
        { sourceTaskKey: 'CAD-482', name: 'Template' },
        'template-key',
      ),
    );
    expect(calls[0]?.idempotencyKey).toBe('template-key');
  });

  it('checks a template read against its identity and version', async () => {
    const id = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    answer('get', `/internal/v1/spaces/${SPACE_ID}/task-templates/${id}`, () =>
      json(responseExample('get', '/v1/spaces/{spaceId}/task-templates/{templateId}', 200), 200, {
        ETag: '"1"',
      }),
    );
    await expect(asCamille(() => client.getTaskTemplate(SPACE_ID, id))).resolves.toMatchObject({
      id,
      version: 1,
    });
  });

  it.each([
    [
      'missing ETag',
      {
        Location: `/internal/v1/spaces/${SPACE_ID}/task-templates/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01`,
      },
    ],
    [
      'wrong Location',
      {
        ETag: '"1"',
        Location: `/internal/v1/spaces/${SPACE_ID}/task-templates/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f02`,
      },
    ],
  ])('rejects template creation with %s', async (_reason, headers) => {
    answer('post', `/internal/v1/spaces/${SPACE_ID}/task-templates`, () =>
      json(responseExample('post', '/v1/spaces/{spaceId}/task-templates', 201), 201, headers),
    );
    await expect(
      asCamille(() =>
        client.createTaskTemplate(
          SPACE_ID,
          { sourceTaskKey: 'CAD-482', name: 'Template' },
          undefined,
        ),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('forwards milestone pagination', async () => {
    answer('get', `/internal/v1/spaces/${SPACE_ID}/milestones`, () =>
      json({ items: [], nextCursor: null, total: 0 }),
    );
    await asCamille(() => client.listSpaceMilestones(SPACE_ID, { cursor: 'page', limit: 12 }));
    expect(calls[0]?.url).toBe(`/internal/v1/spaces/${SPACE_ID}/milestones?cursor=page&limit=12`);
  });

  it('checks task duplication location and ETag and forwards both request headers', async () => {
    const task = responseExample('get', '/v1/tasks/{taskKey}', 200) as {
      key: string;
      version: number;
    };
    answer('post', '/internal/v1/tasks/CAD-482/duplicate', () =>
      json(task, 201, {
        Location: `/internal/v1/tasks/${task.key}`,
        ETag: `"${String(task.version)}"`,
      }),
    );
    await asCamille(() => client.duplicateTask('CAD-482', {}, '"12"', 'copy-key'));
    expect(calls[0]?.ifMatch).toBe('"12"');
    expect(calls[0]?.idempotencyKey).toBe('copy-key');
  });

  it('checks list duplication location and ETag and forwards both request headers', async () => {
    const list = responseExample('get', '/v1/lists/{listId}', 200) as {
      id: string;
      version: number;
    };
    answer('post', `/internal/v1/lists/${LIST_ID}/duplicate`, () =>
      json({ list, taskCount: 0 }, 201, {
        Location: `/internal/v1/lists/${list.id}`,
        ETag: `"${String(list.version)}"`,
      }),
    );
    await asCamille(() => client.duplicateList(LIST_ID, {}, '"12"', 'copy-key'));
    expect(calls[0]?.ifMatch).toBe('"12"');
    expect(calls[0]?.idempotencyKey).toBe('copy-key');
  });

  it('refuses task duplication when the upstream ETag disagrees with the body', async () => {
    const task = responseExample('get', '/v1/tasks/{taskKey}', 200) as { key: string };
    answer('post', '/internal/v1/tasks/CAD-482/duplicate', () =>
      json(task, 201, { Location: `/internal/v1/tasks/${task.key}`, ETag: '"999"' }),
    );
    await expect(
      asCamille(() => client.duplicateTask('CAD-482', {}, undefined, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('refuses list duplication with a mismatched upstream Location', async () => {
    const list = responseExample('get', '/v1/lists/{listId}', 200) as { version: number };
    answer('post', `/internal/v1/lists/${LIST_ID}/duplicate`, () =>
      json({ list, taskCount: 0 }, 201, {
        Location: '/internal/v1/lists/wrong',
        ETag: `"${String(list.version)}"`,
      }),
    );
    await expect(
      asCamille(() => client.duplicateList(LIST_ID, {}, undefined, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('validates dependency creation headers and returns the anchor version', async () => {
    const edgeId = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    answer('post', '/internal/v1/tasks/CAD-482/dependencies', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/dependencies', 201), 201, {
        ETag: '"13"',
        Location: `/internal/v1/tasks/CAD-482/dependencies/${edgeId}`,
      }),
    );
    const result = await asCamille(() =>
      client.createTaskDependency(
        'CAD-482',
        { otherTaskKey: 'CAD-483', direction: 'blocks' },
        '"12"',
        'edge-key',
      ),
    );
    expect(result.version).toBe(13);
    expect(calls[0]?.ifMatch).toBe('"12"');
    expect(calls[0]?.idempotencyKey).toBe('edge-key');
  });

  it.each([
    [
      'missing ETag',
      { Location: '/internal/v1/tasks/CAD-482/dependencies/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01' },
    ],
    [
      'wrong Location',
      {
        ETag: '"13"',
        Location: '/internal/v1/tasks/CAD-483/dependencies/019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01',
      },
    ],
  ])('rejects dependency creation with %s', async (_reason, headers) => {
    answer('post', '/internal/v1/tasks/CAD-482/dependencies', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/dependencies', 201), 201, headers),
    );
    await expect(
      asCamille(() =>
        client.createTaskDependency(
          'CAD-482',
          { otherTaskKey: 'CAD-483', direction: 'blocks' },
          undefined,
          undefined,
        ),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('reads the anchor version from the deletion ETag', async () => {
    const edgeId = '019a7007-8b9c-7d0e-8f1a-2b3c4d5e6f01';
    answer(
      'delete',
      `/internal/v1/tasks/CAD-482/dependencies/${edgeId}`,
      () => new Response(null, { status: 204, headers: { ETag: '"14"' } }),
    );
    await expect(
      asCamille(() => client.deleteTaskDependency('CAD-482', edgeId, '"13"')),
    ).resolves.toBe(14);
    expect(calls[0]?.ifMatch).toBe('"13"');
  });

  it('forwards direction, search and pagination for dependency candidates', async () => {
    answer('get', '/internal/v1/tasks/CAD-482/dependency-candidates', () =>
      json({ items: [], nextCursor: null, total: 0 }),
    );
    await asCamille(() =>
      client.listDependencyCandidates('CAD-482', {
        direction: 'blocked-by',
        search: 'login',
        cursor: 'page',
        limit: 12,
      }),
    );
    expect(calls[0]?.url).toBe(
      '/internal/v1/tasks/CAD-482/dependency-candidates?cursor=page&limit=12&direction=blocked-by&search=login',
    );
  });

  it('relays watcher changes once and reads the task version from ETag', async () => {
    answer('put', `/internal/v1/tasks/CAD-482/watchers/${CAMILLE.id}`, () =>
      json({ userId: CAMILLE.id }, 200, { ETag: '"13"' }),
    );
    answer(
      'delete',
      `/internal/v1/tasks/CAD-482/watchers/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: { ETag: '"14"' } }),
    );
    await expect(
      asCamille(() => client.followTaskWatcher('CAD-482', CAMILLE.id, {}, '"12"')),
    ).resolves.toEqual({ watcher: { userId: CAMILLE.id }, version: 13 });
    await expect(
      asCamille(() => client.unfollowTaskWatcher('CAD-482', CAMILLE.id, '"13"')),
    ).resolves.toBe(14);
    expect(calls.map((item: ReceivedCall) => item.ifMatch)).toEqual(['"12"', '"13"']);
  });

  it('rejects a watcher response with no strong task ETag', async () => {
    answer('put', `/internal/v1/tasks/CAD-482/watchers/${CAMILLE.id}`, () =>
      json({ userId: CAMILLE.id }, 200),
    );
    await expect(
      asCamille(() => client.followTaskWatcher('CAD-482', CAMILLE.id, {}, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('validates and forwards watcher pagination', async () => {
    answer('get', '/internal/v1/tasks/CAD-482/watchers', () =>
      json(responseExample('get', '/v1/tasks/{taskKey}/watchers', 200)),
    );
    await asCamille(() => client.listTaskWatchers('CAD-482', { cursor: 'page', limit: 12 }));
    expect(calls[0]?.url).toBe('/internal/v1/tasks/CAD-482/watchers?cursor=page&limit=12');
  });

  it('validates the comment creation response headers and task key', async () => {
    const id = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
    answer('post', '/internal/v1/tasks/CAD-482/comments', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/comments', 201), 201, {
        ETag: '"1"',
        Location: `/internal/v1/tasks/CAD-482/comments/${id}`,
      }),
    );
    await expect(
      asCamille(() => client.createTaskComment('CAD-482', { body: 'hello' }, 'key')),
    ).resolves.toMatchObject({ id, taskKey: 'CAD-482', version: 1 });
  });

  it.each([
    [
      'missing ETag',
      { Location: '/internal/v1/tasks/CAD-482/comments/019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01' },
      false,
    ],
    [
      'wrong ETag',
      {
        ETag: '"2"',
        Location: '/internal/v1/tasks/CAD-482/comments/019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01',
      },
      false,
    ],
    ['missing Location', { ETag: '"1"' }, false],
    [
      'wrong Location',
      {
        ETag: '"1"',
        Location: '/internal/v1/tasks/CAD-482/comments/019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b02',
      },
      false,
    ],
    [
      'wrong task',
      {
        ETag: '"1"',
        Location: '/internal/v1/tasks/CAD-482/comments/019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01',
      },
      true,
    ],
  ])('rejects a comment creation with %s', async (_case, headers, wrongTask) => {
    const comment = responseExample('post', '/v1/tasks/{taskKey}/comments', 201) as Record<
      string,
      unknown
    >;
    answer('post', '/internal/v1/tasks/CAD-482/comments', () =>
      json({ ...comment, ...(wrongTask ? { taskKey: 'CAD-483' } : {}) }, 201, headers),
    );
    await expect(
      asCamille(() => client.createTaskComment('CAD-482', { body: 'hello' }, 'key')),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it.each([
    ['get', 200, '"1"'],
    ['patch', 200, '"2"'],
  ] as const)('validates comment identity and ETag on %s', async (method, status, etag) => {
    const id = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
    const path = `/internal/v1/tasks/CAD-482/comments/${id}`;
    const body = responseExample(method, '/v1/tasks/{taskKey}/comments/{commentId}', status);
    answer(method, path, () => json(body, status, { ETag: etag }));
    const call = () =>
      method === 'get'
        ? client.getTaskComment('CAD-482', id)
        : client.updateTaskComment('CAD-482', id, { body: 'hello' }, '"1"');
    await expect(asCamille(call)).resolves.toMatchObject({ id, taskKey: 'CAD-482' });
  });

  it.each([
    ['get', 'wrong id'],
    ['get', 'wrong task'],
    ['get', 'missing ETag'],
    ['get', 'wrong ETag'],
    ['patch', 'wrong id'],
    ['patch', 'wrong task'],
    ['patch', 'missing ETag'],
    ['patch', 'wrong ETag'],
  ] as const)('rejects %s comment with %s', async (method, defect) => {
    const id = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
    const comment = responseExample(
      method,
      '/v1/tasks/{taskKey}/comments/{commentId}',
      200,
    ) as Record<string, unknown>;
    const body = {
      ...comment,
      ...(defect === 'wrong id' ? { id: '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b02' } : {}),
      ...(defect === 'wrong task' ? { taskKey: 'CAD-483' } : {}),
    };
    const etag = defect === 'wrong ETag' ? '"999"' : method === 'get' ? '"1"' : '"2"';
    answer(method, `/internal/v1/tasks/CAD-482/comments/${id}`, () =>
      json(body, 200, defect === 'missing ETag' ? {} : { ETag: etag }),
    );
    const call = () =>
      method === 'get'
        ? client.getTaskComment('CAD-482', id)
        : client.updateTaskComment('CAD-482', id, { body: 'hello' }, '"1"');
    await expect(asCamille(call)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('rejects a watcher response naming another user', async () => {
    answer('put', `/internal/v1/tasks/CAD-482/watchers/${CAMILLE.id}`, () =>
      json({ userId: '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31' }, 200, { ETag: '"13"' }),
    );
    await expect(
      asCamille(() => client.followTaskWatcher('CAD-482', CAMILLE.id, {}, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('forwards comment and participant pagination and validates both pages', async () => {
    answer('get', '/internal/v1/tasks/CAD-482/comments', () =>
      json({ items: [], nextCursor: null, total: 0 }),
    );
    answer('get', '/internal/v1/tasks/CAD-482/participants', () =>
      json(responseExample('get', '/v1/tasks/{taskKey}/participants', 200)),
    );
    await asCamille(() => client.listTaskComments('CAD-482', { cursor: 'page', limit: 12 }));
    await asCamille(() => client.listTaskParticipants('CAD-482', { cursor: 'page', limit: 12 }));
    expect(calls.map((call: ReceivedCall) => call.url)).toEqual([
      '/internal/v1/tasks/CAD-482/comments?cursor=page&limit=12',
      '/internal/v1/tasks/CAD-482/participants?cursor=page&limit=12',
    ]);
  });

  it('forwards the comment creation idempotency key without retrying', async () => {
    answer('post', '/internal/v1/tasks/CAD-482/comments', () =>
      json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503),
    );
    await expect(
      asCamille(() => client.createTaskComment('CAD-482', { body: 'hello' }, 'comment-key')),
    ).rejects.toMatchObject({ problem: { status: 503 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.idempotencyKey).toBe('comment-key');
  });

  it('sends a comment edit once with its required If-Match', async () => {
    answer(
      'patch',
      '/internal/v1/tasks/CAD-482/comments/019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01',
      () => json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503),
    );
    await expect(
      asCamille(() =>
        client.updateTaskComment(
          'CAD-482',
          '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01',
          { body: 'hello' },
          '"1"',
        ),
      ),
    ).rejects.toMatchObject({ problem: { status: 503 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.ifMatch).toBe('"1"');
  });

  it('never retries a change carrying If-Match, whose repeat would answer 412', async () => {
    answer('patch', '/internal/v1/tasks/CAD-482', () =>
      json({ type: 'about:blank', status: 503, code: 'service.unavailable' }, 503),
    );

    await expect(
      asCamille(() => client.updateTask('CAD-482', { name: 'Renommée' }, '"12"')),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.unavailable' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.ifMatch).toBe('"12"');
  });

  it('reads the version of an unassignment from the ETag of its 204', async () => {
    answer(
      'delete',
      `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: { ETag: '"13"' } }),
    );

    await expect(asCamille(() => client.unassignTask('CAD-482', CAMILLE.id, '"12"'))).resolves.toBe(
      13,
    );
  });

  it('answers an unassignment without a strong ETag as 503 upstream.failed', async () => {
    answer(
      'delete',
      `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: { ETag: 'W/"13"' } }),
    );

    await expect(
      asCamille(() => client.unassignTask('CAD-482', CAMILLE.id, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('reads the id of a checklist item from the Location task-service answers', async () => {
    const id = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e99';
    answer('post', '/internal/v1/tasks/CAD-482/checklist-items', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/checklist-items', 201), 201, {
        Location: `/internal/v1/tasks/CAD-482/checklist-items/${id}`,
      }),
    );

    const added = await asCamille(() =>
      client.addChecklistItem('CAD-482', { text: 'Relire les messages' }, undefined),
    );

    expect(added.checklistItemId).toBe(id);
  });

  it('answers a checklist item without a Location naming it as 503 upstream.failed', async () => {
    answer('post', '/internal/v1/tasks/CAD-482/checklist-items', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/checklist-items', 201), 201),
    );

    await expect(
      asCamille(() => client.addChecklistItem('CAD-482', { text: 'Relire' }, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('accepts the id of a checklist item in upper case, and refuses a Location of another task', async () => {
    const id = '019A7C00-1A2B-7C3D-8E4F-5A6B7C8D9E99';
    let location = `/internal/v1/tasks/CAD-482/checklist-items/${id}`;
    answer('post', '/internal/v1/tasks/CAD-482/checklist-items', () =>
      json(responseExample('post', '/v1/tasks/{taskKey}/checklist-items', 201), 201, {
        Location: location,
      }),
    );

    await expect(
      asCamille(() => client.addChecklistItem('CAD-482', { text: 'Relire' }, undefined)),
    ).resolves.toMatchObject({ checklistItemId: id });
    location = `/internal/v1/tasks/CAD-999/checklist-items/${id}`;
    await expect(
      asCamille(() => client.addChecklistItem('CAD-482', { text: 'Relire' }, undefined)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('reads the core of the detail, checked against the internal contract', async () => {
    answer('get', '/internal/v1/tasks/CAD-483/detail', () => json(taskDetailCore()));

    await expect(asCamille(() => client.getTaskDetail('CAD-483'))).resolves.toEqual(
      taskDetailCore(),
    );
  });

  it('relays a client error with its code and details, naming task-service', async () => {
    answer('patch', '/internal/v1/tasks/CAD-482', () =>
      json(
        {
          type: 'about:blank',
          title: 'Internal wording',
          status: 412,
          code: 'request.version-mismatch',
          details: { version: 14 },
        },
        412,
      ),
    );

    const failure: unknown = await asCamille(() =>
      client.updateTask('CAD-482', { name: 'x' }, '"12"'),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProblemException);
    expect((failure as ProblemException).problem).toMatchObject({
      status: 412,
      code: 'request.version-mismatch',
      details: { version: 14, service: TASK_SERVICE },
    });
  });

  it('answers an answer outside the internal contract as 503 upstream.failed', async () => {
    answer('get', '/internal/v1/labels', () => json({ items: 'not a list' }));

    await expect(asCamille(() => client.listLabels({ limit: 20 }))).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed', details: { service: TASK_SERVICE } },
    });
  });

  it('refuses to send a request outside the internal contract, without calling', async () => {
    await expect(asCamille(async () => client.listLabels({ limit: 0 }))).rejects.toThrow(
      'outside the internal contract: limit',
    );
    expect(calls).toHaveLength(0);
  });

  it('sends every space, list and task call to its internal path', async () => {
    const SPACE = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
    const LIST = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
    const ITEM = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e10';
    const routes: readonly [
      'get' | 'post' | 'put' | 'patch',
      string,
      string,
      number,
      () => Promise<unknown>,
    ][] = [
      ['get', '/internal/v1/spaces', '/v1/spaces', 200, () => client.listSpaces({ limit: 20 })],
      [
        'post',
        '/internal/v1/spaces',
        '/v1/spaces',
        201,
        () => client.createSpace({ name: 'RH', prefix: 'RH' }, undefined),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE}`,
        '/v1/spaces/{spaceId}',
        200,
        () => client.getSpace(SPACE),
      ],
      [
        'patch',
        `/internal/v1/spaces/${SPACE}`,
        '/v1/spaces/{spaceId}',
        200,
        () => client.updateSpace(SPACE, { name: 'Produit' }, undefined),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE}/overview`,
        '/v1/spaces/{spaceId}/overview',
        200,
        () => client.getSpaceOverview(SPACE, { today: '2026-11-18', limit: 20 }),
      ],
      [
        'post',
        `/internal/v1/spaces/${SPACE}/lists`,
        '/v1/spaces/{spaceId}/lists',
        201,
        () => client.createList(SPACE, { name: 'Sprint 15' }, 'k'),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE}/lists`,
        '/v1/spaces/{spaceId}/lists',
        200,
        () => client.listLists(SPACE, { limit: 20 }),
      ],
      ['get', `/internal/v1/lists/${LIST}`, '/v1/lists/{listId}', 200, () => client.getList(LIST)],
      [
        'patch',
        `/internal/v1/lists/${LIST}`,
        '/v1/lists/{listId}',
        200,
        () => client.updateList(LIST, { name: 'Sprint 14' }, '"2"'),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST}/counts`,
        '/v1/lists/{listId}/counts',
        200,
        () => client.getListCounts(LIST, { today: '2026-11-18' }),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST}/activity`,
        '/v1/lists/{listId}/activity',
        200,
        () => client.listListActivity(LIST, { limit: 20 }),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST}/task-groups`,
        '/v1/lists/{listId}/task-groups',
        200,
        () => client.countTaskGroups(LIST, { groupBy: 'status', level: 'roots', limit: 20 }),
      ],
      [
        'get',
        '/internal/v1/tasks/CAD-482/subtasks',
        '/v1/tasks/{taskKey}/subtasks',
        200,
        () => client.listSubtasks('CAD-482', { limit: 20 }),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/subtasks',
        '/v1/tasks/{taskKey}/subtasks',
        201,
        () => client.createSubtask('CAD-482', { name: 'Tester' }, undefined),
      ],
      [
        'patch',
        `/internal/v1/tasks/CAD-482/checklist-items/${ITEM}`,
        '/v1/tasks/{taskKey}/checklist-items/{checklistItemId}',
        200,
        () => client.updateChecklistItem('CAD-482', ITEM, { done: true }, undefined),
      ],
      [
        'put',
        `/internal/v1/tasks/CAD-482/assignees/${CAMILLE.id}`,
        '/v1/tasks/{taskKey}/assignees/{userId}',
        200,
        () => client.assignTask('CAD-482', CAMILLE.id, undefined),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/labels/add',
        '/v1/tasks/{taskKey}/labels/add',
        200,
        () => client.addTaskLabel('CAD-482', { name: 'Sécurité' }, '"12"'),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/labels/remove',
        '/v1/tasks/{taskKey}/labels/remove',
        200,
        () => client.removeTaskLabel('CAD-482', { name: 'Front' }, undefined),
      ],
      [
        'get',
        '/internal/v1/tasks/CAD-482/activity',
        '/v1/tasks/{taskKey}/activity',
        200,
        () => client.listTaskActivity('CAD-482', { limit: 20 }),
      ],
      [
        'get',
        `/internal/v1/users/${CAMILLE.id}/tasks`,
        '/v1/me/tasks',
        200,
        () => client.listMyTasks(CAMILLE.id, { state: 'open', limit: 20 }),
      ],
    ];
    for (const [method, internalPath, publicPath, status] of routes) {
      answer(method, internalPath, () =>
        json(responseExample(method === 'put' ? 'put' : method, publicPath, status), status),
      );
    }

    for (const [, , , , call] of routes) {
      await asCamille(call);
    }

    expect(
      calls.map((call: ReceivedCall) => `${call.method} ${call.url.split('?')[0] ?? ''}`),
    ).toEqual(routes.map(([method, internalPath]) => `${method.toUpperCase()} ${internalPath}`));
  });

  /**
   * Builds the answer of a public example, which the internal contract shares.
   *
   * @param method - Method of the public operation.
   * @param path - Path of the public operation.
   * @param status - Success status of the operation.
   * @param headers - Further headers.
   * @returns A function building the answer.
   */
  function example(
    method: SpecMethod,
    path: string,
    status = 200,
    headers: Record<string, string> = {},
  ): () => Response {
    return () => json(responseExample(method, path, status), status, headers);
  }

  /**
   * Builds an answer without a body.
   *
   * @param status - The status.
   * @param headers - Further headers.
   * @returns A function building the answer.
   */
  function empty(status: number, headers: Record<string, string> = {}): () => Response {
    return () => new Response(null, { status, headers });
  }

  it('sends every deletion, grant, access request, archive and trash call to its internal path, and none to an access check', async () => {
    const routes: readonly [
      'get' | 'post' | 'put' | 'delete',
      string,
      () => Response,
      () => Promise<unknown>,
    ][] = [
      [
        'delete',
        `/internal/v1/spaces/${SPACE_ID}`,
        empty(204),
        () => client.deleteSpace(SPACE_ID, '"3"'),
      ],
      [
        'delete',
        `/internal/v1/lists/${LIST_ID}`,
        empty(204),
        () => client.deleteList(LIST_ID, undefined),
      ],
      [
        'get',
        `/internal/v1/spaces/${SPACE_ID}/grants`,
        example('get', '/v1/spaces/{spaceId}/grants'),
        () => client.listSpaceGrants(SPACE_ID, { limit: 20 }),
      ],
      [
        'put',
        `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
        example('put', '/v1/spaces/{spaceId}/grants/{userId}', 200, { ETag: '"8"' }),
        () => client.setSpaceGrant(SPACE_ID, CAMILLE.id, { role: 'edit' }, undefined),
      ],
      [
        'delete',
        `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
        empty(204, { ETag: '"9"' }),
        () => client.removeSpaceGrant(SPACE_ID, CAMILLE.id, undefined),
      ],
      [
        'get',
        `/internal/v1/lists/${LIST_ID}/grants`,
        example('get', '/v1/lists/{listId}/grants'),
        () => client.listListGrants(LIST_ID, { limit: 20 }),
      ],
      [
        'put',
        `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
        example('put', '/v1/lists/{listId}/grants/{userId}', 200, { ETag: '"4"' }),
        () => client.setListGrant(LIST_ID, CAMILLE.id, { role: 'comment' }, undefined),
      ],
      [
        'delete',
        `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
        empty(204, { ETag: '"5"' }),
        () => client.removeListGrant(LIST_ID, CAMILLE.id, undefined),
      ],
      [
        'post',
        '/internal/v1/access-requests',
        empty(202),
        () => client.createAccessRequest({ spaceId: SPACE_ID, message: null }),
      ],
      [
        'get',
        '/internal/v1/access-requests',
        example('get', '/v1/access-requests'),
        () => client.listAccessRequests({ limit: 20 }),
      ],
      [
        'post',
        `/internal/v1/access-requests/${ACCESS_REQUEST_ID}/approval`,
        example('post', '/v1/access-requests/{accessRequestId}/approval'),
        () => client.approveAccessRequest(ACCESS_REQUEST_ID, { role: 'view' }),
      ],
      [
        'post',
        `/internal/v1/access-requests/${ACCESS_REQUEST_ID}/refusal`,
        example('post', '/v1/access-requests/{accessRequestId}/refusal'),
        () => client.refuseAccessRequest(ACCESS_REQUEST_ID, {}),
      ],
      [
        'post',
        `/internal/v1/lists/${LIST_ID}/archive`,
        example('post', '/v1/lists/{listId}/archive'),
        () => client.archiveList(LIST_ID, {}, undefined),
      ],
      [
        'post',
        `/internal/v1/lists/${LIST_ID}/unarchive`,
        example('post', '/v1/lists/{listId}/unarchive'),
        () => client.unarchiveList(LIST_ID, {}, undefined),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/archive',
        example('post', '/v1/tasks/{taskKey}/archive'),
        () => client.archiveTask('CAD-482', {}, undefined),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/unarchive',
        example('post', '/v1/tasks/{taskKey}/unarchive'),
        () => client.unarchiveTask('CAD-482', {}, undefined),
      ],
      [
        'get',
        '/internal/v1/archives/lists',
        example('get', '/v1/archives/lists'),
        () => client.listArchivedLists({ limit: 20 }),
      ],
      [
        'get',
        '/internal/v1/archives/tasks',
        example('get', '/v1/archives/tasks'),
        () => client.listArchivedTasks({ limit: 20 }),
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/trash',
        example('post', '/v1/tasks/{taskKey}/trash'),
        () => client.trashTask('CAD-482', {}, undefined),
      ],
      [
        'get',
        '/internal/v1/trash/entries',
        example('get', '/v1/trash/entries'),
        () => client.listTrash({ limit: 20 }),
      ],
      [
        'delete',
        `/internal/v1/trash/entries/${ENTRY_ID}`,
        empty(204),
        () => client.purgeTrashEntry(ENTRY_ID),
      ],
      [
        'post',
        `/internal/v1/trash/entries/${ENTRY_ID}/restore`,
        example('post', '/v1/trash/entries/{entryId}/restore'),
        () => client.restoreTrashEntry(ENTRY_ID, {}, {}),
      ],
      [
        'post',
        '/internal/v1/trash/empty',
        example('post', '/v1/trash/empty', 202),
        () => client.emptyTrash({}),
      ],
    ];
    for (const [method, internalPath, reply] of routes) {
      answer(method, internalPath, reply);
    }

    for (const [, , , call] of routes) {
      await asCamille(call);
    }

    const sent: readonly string[] = calls.map(
      (call: ReceivedCall) => `${call.method} ${call.url.split('?')[0] ?? ''}`,
    );
    expect(sent).toEqual(
      routes.map(([method, internalPath]) => `${method.toUpperCase()} ${internalPath}`),
    );
    expect(sent.filter((line: string) => line.endsWith('/access'))).toEqual([]);
  });

  it('checks attachment permissions with the current user and requested mode', async () => {
    answer(
      'get',
      '/internal/v1/tasks/CAD-482/attachment-access',
      () => new HttpResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }),
    );

    await expect(
      asCamille(() => client.checkTaskAttachmentAccess('CAD-482', 'write')),
    ).resolves.toBeUndefined();
    expect(calls[0]?.url).toBe('/internal/v1/tasks/CAD-482/attachment-access?mode=write');
    expect(calls[0]?.principal).toMatchObject({
      issuer: GATEWAY_ISSUER,
      actor: { type: 'user', id: CAMILLE.id },
      organizationId: ATELIER_NORD_ID,
    });
  });

  it('refuses an attachment access decision without the required no-store header', async () => {
    answer(
      'get',
      '/internal/v1/tasks/CAD-482/attachment-access',
      () => new HttpResponse(null, { status: 204 }),
    );

    await expect(
      asCamille(() => client.checkTaskAttachmentAccess('CAD-482', 'read')),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(calls).toHaveLength(1);
  });

  it('exposes the gateway attachment check while keeping realtime-only access checks private', () => {
    const methods: readonly string[] = Object.getOwnPropertyNames(TaskServiceClient.prototype);
    const source: string = readFileSync(
      new URL('./task-service.client.ts', import.meta.url),
      'utf8',
    );

    expect(methods.filter((name: string) => /^check|Access$/u.test(name))).toEqual([
      'checkTaskAttachmentAccess',
    ]);
    expect(source).not.toContain('checkListAccessInternal');
    expect(source).not.toContain('checkTaskAccessInternal');
  });

  it('answers a success status other than the contract declares as 503 upstream.failed', async () => {
    const cases: readonly ['delete' | 'post', string, () => Promise<unknown>][] = [
      ['delete', `/internal/v1/spaces/${SPACE_ID}`, () => client.deleteSpace(SPACE_ID, undefined)],
      ['delete', `/internal/v1/lists/${LIST_ID}`, () => client.deleteList(LIST_ID, undefined)],
      [
        'post',
        '/internal/v1/access-requests',
        () => client.createAccessRequest({ spaceId: SPACE_ID }),
      ],
      ['delete', `/internal/v1/trash/entries/${ENTRY_ID}`, () => client.purgeTrashEntry(ENTRY_ID)],
      ['post', '/internal/v1/trash/empty', () => client.emptyTrash({})],
    ];
    for (const [method, internalPath] of cases) {
      answer(method, internalPath, () => json({ entryCount: 2 }, 200));
    }

    for (const [, , call] of cases) {
      await expect(asCamille(call)).rejects.toMatchObject({
        problem: { status: 503, code: 'upstream.failed', details: { service: TASK_SERVICE } },
      });
    }
  });

  it('resolves an access request with nothing and the emptying of the trash with its validated count', async () => {
    answer('post', '/internal/v1/access-requests', empty(202));
    answer('post', '/internal/v1/trash/empty', () => json({ entryCount: 2, extra: true }, 202));

    await expect(
      asCamille(() => client.createAccessRequest({ taskKey: 'DIR-12', message: null })),
    ).resolves.toBeUndefined();
    await expect(asCamille(() => client.emptyTrash({}))).resolves.toEqual({ entryCount: 2 });
    expect(calls.map((call: ReceivedCall) => call.body)).toEqual([
      { taskKey: 'DIR-12', message: null },
      {},
    ]);
  });

  it('refuses to send a grant, an approval, an access request or a page outside the internal contract, without calling', async () => {
    const cases: readonly [() => Promise<unknown>, string][] = [
      [() => client.setSpaceGrant(SPACE_ID, CAMILLE.id, { role: 'owner' }, undefined), 'role'],
      [() => client.setListGrant(LIST_ID, CAMILLE.id, { role: 'admin' }, undefined), 'role'],
      [() => client.approveAccessRequest(ACCESS_REQUEST_ID, {}), 'role'],
      [() => client.createAccessRequest({ spaceId: 'not-an-id' }), 'spaceId'],
      [() => client.listAccessRequests({ listId: 'not-an-id' }), 'listId'],
      [() => client.listSpaceGrants(SPACE_ID, { limit: 101 }), 'limit'],
      [() => client.listListGrants(LIST_ID, { limit: 0 }), 'limit'],
      [() => client.listArchivedLists({ limit: 0 }), 'limit'],
      [() => client.listArchivedTasks({ limit: 101 }), 'limit'],
      [() => client.listTrash({ limit: 0 }), 'limit'],
    ];

    for (const [call, member] of cases) {
      await expect(asCamille(async () => call())).rejects.toThrow(
        `outside the internal contract: ${member}`,
      );
    }
    expect(calls).toHaveLength(0);
  });

  it('relays the filters of the access requests and the empty body of an action with its If-Match', async () => {
    answer('get', '/internal/v1/access-requests', example('get', '/v1/access-requests'));
    answer(
      'post',
      '/internal/v1/tasks/CAD-482/archive',
      example('post', '/v1/tasks/{taskKey}/archive'),
    );

    await asCamille(() => client.listAccessRequests({ spaceId: SPACE_ID, limit: 20 }));
    await asCamille(() => client.archiveTask('CAD-482', {}, '"12"'));

    expect(calls[0]?.url).toBe(`/internal/v1/access-requests?spaceId=${SPACE_ID}&limit=20`);
    expect(calls[1]).toMatchObject({ body: {}, ifMatch: '"12"' });
  });

  it.each(CHANGE_CASES)(
    'sends $label once, after a connection error and after a 503',
    async (change: ChangeCase) => {
      for (const [failure, fail, code] of RETRYABLE_FAILURES) {
        server.resetHandlers();
        calls = [];
        answer(change.method, change.path, fail);
        // A fresh breaker for each failure, so that the answer is the failure itself.
        const once: TaskServiceClient = newClient();

        await expect(
          asCamille(() => change.send(once, change.ifMatch)),
          failure,
        ).rejects.toMatchObject({
          problem: { status: 503, code, details: { service: TASK_SERVICE } },
        });
        expect(
          calls.map((call: ReceivedCall) => ({
            method: call.method,
            url: call.url,
            ifMatch: call.ifMatch,
          })),
          failure,
        ).toEqual([
          {
            method: change.method.toUpperCase(),
            url: change.path + (change.name === 'restoreTrashEntry' ? '?reportNotReady=false' : ''),
            ifMatch: change.ifMatch ?? null,
          },
        ]);
      }
    },
  );

  it('never gives again a grant another manager revoked while the answer of its PUT was lost', async () => {
    const grants: readonly {
      readonly path: string;
      readonly give: (client: TaskServiceClient) => Promise<unknown>;
      readonly revoke: (client: TaskServiceClient) => Promise<unknown>;
    }[] = [
      {
        path: `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
        give: (manager) => manager.setSpaceGrant(SPACE_ID, CAMILLE.id, { role: 'edit' }, undefined),
        revoke: (manager) => manager.removeSpaceGrant(SPACE_ID, CAMILLE.id, undefined),
      },
      {
        path: `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
        give: (manager) => manager.setListGrant(LIST_ID, CAMILLE.id, { role: 'edit' }, undefined),
        revoke: (manager) => manager.removeListGrant(LIST_ID, CAMILLE.id, undefined),
      },
    ];

    for (const grant of grants) {
      for (const [failure, fail, code] of RETRYABLE_FAILURES) {
        server.resetHandlers();
        // The fake task-service: the role it stores, and every change it committed.
        let role: string | undefined;
        const committed: string[] = [];
        const secondManager: TaskServiceClient = newClient();
        server.use(
          http.put(`${BASE_URL}${grant.path}`, async ({ request }) => {
            const change = (await request.json()) as { role: string };
            role = change.role;
            committed.push(`PUT ${change.role}`);
            if (committed.length === 1) {
              // The answer is lost after the commit; meanwhile a second manager revokes the grant.
              await asCamille(() => grant.revoke(secondManager));
            }
            return fail();
          }),
          http.delete(`${BASE_URL}${grant.path}`, () => {
            role = undefined;
            committed.push('DELETE');
            return new Response(null, { status: 204, headers: { ETag: '"9"' } });
          }),
        );

        await expect(
          asCamille(() => grant.give(newClient())),
          failure,
        ).rejects.toMatchObject({
          problem: { status: 503, code },
        });
        expect(committed, failure).toEqual(['PUT edit', 'DELETE']);
        expect(role, failure).toBeUndefined();
      }
    }
  });

  it.each(RETRYABLE_FAILURES)(
    'still retries a read and a creation with Idempotency-Key once after %s',
    async (_failure: string, fail: () => Response) => {
      const cases: readonly ['get' | 'post', string, () => Response, () => Promise<unknown>][] = [
        [
          'get',
          `/internal/v1/spaces/${SPACE_ID}`,
          example('get', '/v1/spaces/{spaceId}'),
          () => client.getSpace(SPACE_ID),
        ],
        [
          'get',
          `/internal/v1/spaces/${SPACE_ID}/grants`,
          example('get', '/v1/spaces/{spaceId}/grants'),
          () => client.listSpaceGrants(SPACE_ID, { limit: 20 }),
        ],
        [
          'get',
          '/internal/v1/trash/entries',
          example('get', '/v1/trash/entries'),
          () => client.listTrash({ limit: 20 }),
        ],
        [
          'post',
          '/internal/v1/spaces',
          example('post', '/v1/spaces', 201),
          () => client.createSpace({ name: 'RH', prefix: 'RH' }, 'creation-1'),
        ],
        [
          'post',
          `/internal/v1/spaces/${SPACE_ID}/lists`,
          example('post', '/v1/spaces/{spaceId}/lists', 201),
          () => client.createList(SPACE_ID, { name: 'Sprint 15' }, 'creation-2'),
        ],
        [
          'post',
          '/internal/v1/tasks/CAD-482/subtasks',
          example('post', '/v1/tasks/{taskKey}/subtasks', 201),
          () => client.createSubtask('CAD-482', { name: 'Tester' }, 'creation-4'),
        ],
      ];
      for (const [method, internalPath, reply] of cases) {
        let attempts = 0;
        answer(method, internalPath, () => {
          attempts += 1;
          return attempts === 1 ? fail() : reply();
        });
      }

      for (const [, , , call] of cases) {
        await asCamille(call);
      }

      expect(
        calls.map((call: ReceivedCall) => `${call.method} ${call.url.split('?')[0] ?? ''}`),
      ).toEqual(
        cases.flatMap(([method, internalPath]) => {
          const line = `${method.toUpperCase()} ${internalPath}`;
          return [line, line];
        }),
      );
      expect(
        calls
          .map((call: ReceivedCall) => call.idempotencyKey)
          .filter((key: string | null) => key !== null),
      ).toEqual([
        'creation-1',
        'creation-1',
        'creation-2',
        'creation-2',
        'creation-4',
        'creation-4',
      ]);
    },
  );

  it('reads the version of the space or the list from the strong ETag of a grant', async () => {
    const spaceGrant: unknown = responseExample('put', '/v1/spaces/{spaceId}/grants/{userId}', 200);
    const listGrant: unknown = responseExample('put', '/v1/lists/{listId}/grants/{userId}', 200);
    answer('put', `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`, () =>
      json(spaceGrant, 200, { ETag: '"8"' }),
    );
    answer('put', `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`, () =>
      json(listGrant, 200, { ETag: '"4"' }),
    );
    answer(
      'delete',
      `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
      empty(204, { ETag: '"9"' }),
    );
    answer(
      'delete',
      `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
      empty(204, { ETag: '"5"' }),
    );

    await expect(
      asCamille(() => client.setSpaceGrant(SPACE_ID, CAMILLE.id, { role: 'edit' }, '"7"')),
    ).resolves.toEqual({ grant: spaceGrant, version: 8 });
    await expect(
      asCamille(() => client.setListGrant(LIST_ID, CAMILLE.id, { role: 'comment' }, '"3"')),
    ).resolves.toEqual({ grant: listGrant, version: 4 });
    await expect(
      asCamille(() => client.removeSpaceGrant(SPACE_ID, CAMILLE.id, '"8"')),
    ).resolves.toBe(9);
    await expect(asCamille(() => client.removeListGrant(LIST_ID, CAMILLE.id, '"4"'))).resolves.toBe(
      5,
    );
    expect(calls.map((call: ReceivedCall) => call.ifMatch)).toEqual(['"7"', '"3"', '"8"', '"4"']);
    expect(calls.slice(0, 2).map((call: ReceivedCall) => call.body)).toEqual([
      { role: 'edit' },
      { role: 'comment' },
    ]);
  });

  it('answers a grant without a strong ETag as 503 upstream.failed', async () => {
    let etag: Record<string, string> = {};
    answer('put', `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`, () =>
      json(responseExample('put', '/v1/spaces/{spaceId}/grants/{userId}', 200), 200, etag),
    );
    answer('put', `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`, () =>
      json(responseExample('put', '/v1/lists/{listId}/grants/{userId}', 200), 200, etag),
    );
    answer(
      'delete',
      `/internal/v1/spaces/${SPACE_ID}/grants/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: etag }),
    );
    answer(
      'delete',
      `/internal/v1/lists/${LIST_ID}/grants/${CAMILLE.id}`,
      () => new Response(null, { status: 204, headers: etag }),
    );
    const grantCalls: readonly (() => Promise<unknown>)[] = [
      () => client.setSpaceGrant(SPACE_ID, CAMILLE.id, { role: 'edit' }, undefined),
      () => client.setListGrant(LIST_ID, CAMILLE.id, { role: 'edit' }, undefined),
      () => client.removeSpaceGrant(SPACE_ID, CAMILLE.id, undefined),
      () => client.removeListGrant(LIST_ID, CAMILLE.id, undefined),
    ];

    const invalid: readonly Record<string, string>[] = [{}, { ETag: 'W/"8"' }, { ETag: '8' }];
    for (const headers of invalid) {
      etag = headers;
      for (const call of grantCalls) {
        await expect(asCamille(call)).rejects.toMatchObject({
          problem: { status: 503, code: 'upstream.failed', details: { service: TASK_SERVICE } },
        });
      }
    }
  });

  it('keeps the access members of a space and a list through the internal validation', async () => {
    const space: unknown = responseExample('get', '/v1/spaces/{spaceId}', 200);
    const list: unknown = responseExample('get', '/v1/lists/{listId}', 200);
    answer('get', `/internal/v1/spaces/${SPACE_ID}`, () => json(space));
    answer('get', `/internal/v1/lists/${LIST_ID}`, () => json(list));

    const read: unknown = await asCamille(() => client.getSpace(SPACE_ID));
    const readList: unknown = await asCamille(() => client.getList(LIST_ID));

    expect(read).toEqual(space);
    expect(read).toHaveProperty('callerRole');
    expect(read).toHaveProperty('callerCanManage');
    expect(readList).toEqual(list);
    for (const member of ['organizationAccess', 'archivedAt', 'archivedBy', 'callerRole']) {
      expect(readList).toHaveProperty(member);
    }
  });

  it('keeps the archive and trash members of every answer through the internal validation', async () => {
    const cases: readonly [
      'get' | 'post',
      string,
      string,
      () => Promise<unknown>,
      readonly string[],
    ][] = [
      [
        'post',
        `/internal/v1/lists/${LIST_ID}/archive`,
        '/v1/lists/{listId}/archive',
        () => client.archiveList(LIST_ID, {}, undefined),
        ['archivedAt', 'archivedBy', 'organizationAccess', 'callerRole'],
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/archive',
        '/v1/tasks/{taskKey}/archive',
        () => client.archiveTask('CAD-482', {}, undefined),
        ['archivedAt', 'archivedBy'],
      ],
      [
        'get',
        '/internal/v1/archives/lists',
        '/v1/archives/lists',
        () => client.listArchivedLists({}),
        ['items.0.list.archivedAt', 'items.0.list.archivedBy', 'items.0.taskCount'],
      ],
      [
        'get',
        '/internal/v1/archives/tasks',
        '/v1/archives/tasks',
        () => client.listArchivedTasks({}),
        ['items.0.archivedAt', 'items.0.archivedBy', 'items.0.subtaskCount'],
      ],
      [
        'post',
        '/internal/v1/tasks/CAD-482/trash',
        '/v1/tasks/{taskKey}/trash',
        () => client.trashTask('CAD-482', {}, undefined),
        ['parentKey', 'subtaskCount', 'list.state', 'trashedAt', 'trashedBy', 'purgeAt'],
      ],
      [
        'get',
        '/internal/v1/trash/entries',
        '/v1/trash/entries',
        () => client.listTrash({}),
        ['items.0.trashedAt', 'items.0.trashedBy', 'items.0.purgeAt', 'items.0.list.state'],
      ],
      [
        'post',
        `/internal/v1/trash/entries/${ENTRY_ID}/restore`,
        '/v1/trash/entries/{entryId}/restore',
        () => client.restoreTrashEntry(ENTRY_ID, {}, {}),
        ['subtaskCount', 'detached', 'listRestored', 'spaceRestored'],
      ],
    ];
    for (const [method, internalPath, publicPath] of cases) {
      answer(method, internalPath, example(method, publicPath));
    }

    for (const [method, , publicPath, call, members] of cases) {
      const read: unknown = await asCamille(call);
      expect(read).toEqual(responseExample(method, publicPath, 200));
      for (const member of members) {
        expect(read).toHaveProperty(member.split('.'));
      }
    }
  });

  it('builds a fake of task-service whose every call answers an example the internal contract accepts', async () => {
    const fake: FakeTask = createFakeTask();
    const names = Object.keys(fake) as TaskServiceMethod[];

    await expect(
      Promise.all(
        names.map((name: TaskServiceMethod) => (fake[name] as unknown as () => Promise<unknown>)()),
      ),
    ).resolves.toHaveLength(names.length);
    expect([...names].sort()).toEqual(
      Object.getOwnPropertyNames(TaskServiceClient.prototype)
        .filter((name: string) => name !== 'constructor')
        .sort(),
    );
  });
});
