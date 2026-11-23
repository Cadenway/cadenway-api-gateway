import 'reflect-metadata';

import { RequestMethod, type Type } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ROUTE_MODULES } from '../../../../../../app.module.js';
import {
  isNode,
  PUBLIC_SPECS,
  resolveNode,
  type PublicSpec,
  type SpecNode,
} from '../../../../../../../tests/support/public-contract.js';
import {
  acceptsSession,
  apiTokenScopesOf,
  credentialIsOptional,
  needsCredential,
  OPERATION_SECURITY,
  type OperationSecurity,
} from './operation-security.validation.js';

/**
 * Constant SPEC_METHODS
 *
 * @description
 * HTTP methods an operation of the public specs may use, by the `RequestMethod` of NestJS.
 *
 * @type {ReadonlyMap<number, string>}
 */
const SPEC_METHODS: ReadonlyMap<number, string> = new Map<number, string>([
  [RequestMethod.GET, 'get'],
  [RequestMethod.POST, 'post'],
  [RequestMethod.PUT, 'put'],
  [RequestMethod.PATCH, 'patch'],
  [RequestMethod.DELETE, 'delete'],
]);

const BODYLESS_POSTS = new Set([
  'markInboxNotificationsRead',
  'markInboxNotificationRead',
  'archiveInboxNotification',
  'completeReminder',
]);

/**
 * Interface ServedRoute
 *
 * @description
 * A route handler of the gateway, with the security it declares.
 */
interface ServedRoute {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * `<method> <path>`, the path as the specs write it.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property security
   *
   * @description
   * What the handler declares with `CredentialGuard.requires`, when it does.
   *
   * @type {OperationSecurity | undefined}
   * @readonly
   */
  readonly security: OperationSecurity | undefined;
  // #endregion
}

/**
 * Interface ContractOperation
 *
 * @description
 * An operation of the public specs, with the security derived from it.
 */
interface ContractOperation {
  // #region Properties
  /**
   * Property key
   *
   * @description
   * `<method> <path>`.
   *
   * @type {string}
   * @readonly
   */
  readonly key: string;

  /**
   * Property security
   *
   * @description
   * `operationId`, `security` and whether the operation declares `organization.not-selected`.
   *
   * @type {OperationSecurity}
   * @readonly
   */
  readonly security: OperationSecurity;
  // #endregion
}

/**
 * Function joinPath
 *
 * @description
 * Joins the path of a controller and of a handler as the specs write it.
 *
 * @param {string} controllerPath - `@Controller` path.
 * @param {string} handlerPath - Path of the method decorator.
 * @returns {string} `/v1/...`, with `{param}` for `:param`.
 */
function joinPath(controllerPath: string, handlerPath: string): string {
  const segments: string[] = [controllerPath, handlerPath]
    .flatMap((part: string) => part.split('/'))
    .filter((segment: string) => segment !== '');
  return `/${segments.map((segment: string) => segment.replace(/^:(.+)$/u, '{$1}')).join('/')}`;
}

/**
 * Function servedRoutes
 *
 * @description
 * Lists every route handler of `ROUTE_MODULES`, from the metadata NestJS reads.
 *
 * @returns {readonly ServedRoute[]} The routes.
 */
function servedRoutes(): readonly ServedRoute[] {
  const routes: ServedRoute[] = [];
  for (const module of ROUTE_MODULES) {
    const controllers: readonly Type[] =
      (Reflect.getMetadata('controllers', module) as readonly Type[] | undefined) ?? [];
    for (const controller of controllers) {
      const controllerPath: string = String(Reflect.getMetadata('path', controller));
      const prototype: Readonly<Record<string, unknown>> = controller.prototype as Readonly<
        Record<string, unknown>
      >;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler: unknown = prototype[name];
        if (typeof handler !== 'function' || name === 'constructor') {
          continue;
        }
        const method: unknown = Reflect.getMetadata('method', handler);
        const path: unknown = Reflect.getMetadata('path', handler);
        if (typeof method !== 'number' || typeof path !== 'string') {
          continue;
        }
        routes.push({
          key: `${SPEC_METHODS.get(method) ?? 'unknown'} ${joinPath(controllerPath, path)}`,
          security: Reflect.getMetadata(OPERATION_SECURITY, handler) as
            OperationSecurity | undefined,
        });
      }
    }
  }
  return routes;
}

/**
 * Function describedCodes
 *
 * @description
 * Lists the codes a response declares in its description, including codes from a local
 * response component named by an explicit "The codes in ..." reference. This covers
 * codes the description declares without a problem example.
 *
 * @param {PublicSpec} spec - The spec.
 * @param {string} pointer - Pointer of the response, which may be a reference.
 * @returns {readonly string[]} The codes.
 */
function describedCodes(spec: PublicSpec, pointer: string): readonly string[] {
  const description: unknown = resolveNode(spec, pointer).node.description;
  if (typeof description !== 'string') {
    return [];
  }
  const component = /^The codes in `([a-zA-Z0-9_-]+)`/u.exec(description)?.[1];
  const inherited: unknown =
    component === undefined
      ? undefined
      : resolveNode(spec, `/components/responses/${component}`).node.description;
  const listedLines = [description, typeof inherited === 'string' ? inherited : '']
    .flatMap((text) => text.split('\n'))
    .filter((line) => line.trimStart().startsWith('- `') || line.trimStart().startsWith('`'));
  return listedLines.flatMap((line: string) =>
    [...(line.split(':', 1)[0] ?? '').matchAll(/`([a-z-]+(?:\.[a-z-]+)+)`/gu)].map(
      (match) => match[1] ?? '',
    ),
  );
}

/**
 * Function problemCodes
 *
 * @description
 * Lists the `code` of every problem example of a response.
 *
 * @param {PublicSpec} spec - The spec.
 * @param {string} pointer - Pointer of the response, which may be a reference.
 * @returns {readonly string[]} The codes.
 */
function problemCodes(spec: PublicSpec, pointer: string): readonly string[] {
  const response: SpecNode = resolveNode(spec, pointer).node;
  const content: unknown = response.content;
  const media: unknown = isNode(content) ? content['application/problem+json'] : undefined;
  if (!isNode(media)) {
    return [];
  }
  const values: unknown[] = [];
  if (isNode(media.example)) {
    values.push(media.example);
  }
  if (isNode(media.examples)) {
    for (const example of Object.values(media.examples)) {
      if (!isNode(example)) {
        continue;
      }
      const reference: unknown = example.$ref;
      const resolved: SpecNode =
        typeof reference === 'string' ? resolveNode(spec, reference.slice(1)).node : example;
      values.push(resolved.value);
    }
  }
  return values
    .filter(isNode)
    .map((value: SpecNode) => value.code)
    .filter((code: unknown): code is string => typeof code === 'string');
}

/**
 * Detects the optional organization precondition in the installed public spec.
 *
 * @param spec - Published contract containing the parameter or its local reference.
 * @param parameters - Path-level or operation-level parameters.
 * @returns Whether the parameters declare If-Organization-Match.
 */
function declaresOrganizationPrecondition(spec: PublicSpec, parameters: unknown): boolean {
  if (!Array.isArray(parameters)) return false;
  return parameters.some((parameter: unknown) => {
    if (!isNode(parameter)) return false;
    const reference: unknown = parameter.$ref;
    const definition =
      typeof reference === 'string' && reference.startsWith('#/')
        ? resolveNode(spec, reference.slice(1)).node
        : parameter;
    if (
      definition.in !== 'header' ||
      typeof definition.name !== 'string' ||
      definition.name.toLowerCase() !== 'if-organization-match'
    ) {
      return false;
    }
    if (definition.required === true) {
      throw new Error(`${spec.name} declared a required If-Organization-Match header.`);
    }
    return true;
  });
}

/**
 * Function contractOperations
 *
 * @description
 * Lists every operation of the public specs the gateway serves, with its security: the
 * `security` of the operation (or of the document), and `organization` when its `403` declares
 * `organization.not-selected`, in an example or in its description.
 *
 * @returns {readonly ContractOperation[]} The operations.
 */
function contractOperations(): readonly ContractOperation[] {
  const operations: ContractOperation[] = [];
  for (const spec of PUBLIC_SPECS) {
    const paths: unknown = spec.document.paths;
    if (!isNode(paths)) {
      continue;
    }
    for (const [path, item] of Object.entries(paths)) {
      if (!isNode(item)) {
        continue;
      }
      for (const method of SPEC_METHODS.values()) {
        const operation: unknown = item[method];
        if (!isNode(operation)) {
          continue;
        }
        const operationId = String(operation.operationId);
        const security: unknown = operation.security ?? spec.document.security;
        const responses: unknown = operation.responses;
        const escaped: string = path.replaceAll('~', '~0').replaceAll('/', '~1');
        const forbiddenPointer = `/paths/${escaped}/${method}/responses/403`;
        const forbidden: readonly string[] =
          isNode(responses) && isNode(responses['403'])
            ? [...problemCodes(spec, forbiddenPointer), ...describedCodes(spec, forbiddenPointer)]
            : [];
        const bodylessPost = BODYLESS_POSTS.has(operationId);
        const organizationPrecondition =
          declaresOrganizationPrecondition(spec, item.parameters) ||
          declaresOrganizationPrecondition(spec, operation.parameters);
        if (bodylessPost && (method !== 'post' || operation.requestBody !== undefined)) {
          throw new Error(`${operationId} no longer has a bodyless POST contract.`);
        }
        operations.push({
          key: `${method} ${path}`,
          security: {
            operationId,
            security: security as OperationSecurity['security'],
            organization: forbidden.includes('organization.not-selected'),
            ...(bodylessPost ? { allowBodylessPost: true } : {}),
            ...(organizationPrecondition ? { organizationPrecondition: true } : {}),
          },
        });
      }
    }
  }
  return operations;
}

describe('the security of every route against the public contracts', () => {
  const served: readonly ServedRoute[] = servedRoutes();
  const operations: readonly ContractOperation[] = contractOperations();

  it('matches the complete public operation set of the registered specs', () => {
    expect(served.map((route: ServedRoute) => route.key).sort()).toEqual(
      operations.map((operation: ContractOperation) => operation.key).sort(),
    );
    expect(operations).toHaveLength(237);
    expect(
      operations.filter((operation) => operation.security.organizationPrecondition),
    ).toHaveLength(70);
  });

  it('declares organization.mfa-required on every operation that acts on the current organization', () => {
    for (const spec of PUBLIC_SPECS) {
      const paths: unknown = spec.document.paths;
      for (const [path, item] of Object.entries(isNode(paths) ? paths : {})) {
        for (const method of SPEC_METHODS.values()) {
          const operation: unknown = isNode(item) ? item[method] : undefined;
          const escaped: string = path.replaceAll('~', '~0').replaceAll('/', '~1');
          const pointer = `/paths/${escaped}/${method}/responses/403`;
          if (!isNode(operation) || !isNode(operation.responses)) {
            continue;
          }
          const declared: readonly string[] = isNode(operation.responses['403'])
            ? [...problemCodes(spec, pointer), ...describedCodes(spec, pointer)]
            : [];
          if (declared.includes('organization.not-selected')) {
            expect(declared, `${method} ${path}`).toContain('organization.mfa-required');
          }
        }
      }
    }
  });

  it.each(operations.map((operation: ContractOperation) => [operation.key, operation] as const))(
    '%s declares the operationId, security and organization scope of its contract',
    (key, operation) => {
      const route: ServedRoute | undefined = served.find(
        (candidate: ServedRoute) => candidate.key === key,
      );

      expect(route?.security).toEqual(operation.security);
    },
  );

  it('derives a token scope only for member reads and the task operations', () => {
    const withToken: string[] = operations
      .filter((operation: ContractOperation) => apiTokenScopesOf(operation.security) !== undefined)
      .map((operation: ContractOperation) => operation.security.operationId)
      .sort();

    expect(withToken).toEqual(
      [
        'getMember',
        'getMemberAvatar',
        'listMembers',
        'listSpaces',
        'createSpace',
        'getSpace',
        'updateSpace',
        'getSpaceOverview',
        'createList',
        'listLists',
        'getList',
        'updateList',
        'getListCounts',
        'listListActivity',
        'listTasks',
        'createTask',
        'countTaskGroups',
        'getTask',
        'updateTask',
        'getTaskDetail',
        'listSubtasks',
        'createSubtask',
        'addChecklistItem',
        'updateChecklistItem',
        'assignTask',
        'unassignTask',
        'addTaskLabel',
        'removeTaskLabel',
        'listTaskActivity',
        'listLabels',
        'listMyTasks',
        'getHome',
        'getOnboarding',
        'updateOnboarding',
        'updateOnboardingChecklist',
        'finishOnboarding',
        'deleteSpace',
        'deleteList',
        'listSpaceGrants',
        'setSpaceGrant',
        'removeSpaceGrant',
        'listListGrants',
        'setListGrant',
        'removeListGrant',
        'createAccessRequest',
        'listAccessRequests',
        'approveAccessRequest',
        'refuseAccessRequest',
        'archiveList',
        'unarchiveList',
        'archiveTask',
        'unarchiveTask',
        'listArchivedLists',
        'listArchivedTasks',
        'trashTask',
        'listTrash',
        'purgeTrashEntry',
        'restoreTrashEntry',
        'emptyTrash',
        'executeBulkTaskAction',
        'duplicateTask',
        'listTaskComments',
        'createTaskComment',
        'getTaskComment',
        'updateTaskComment',
        'deleteTaskComment',
        'listTaskParticipants',
        'listTaskTimeEntries',
        'createTaskTimeEntry',
        'getTaskTimeEntry',
        'deleteTaskTimeEntry',
        'getTaskTimeSummary',
        'getTaskStatusDurations',
        'getTaskApproval',
        'requestTaskApproval',
        'voteOnTaskApproval',
        'withdrawTaskApprovalVote',
        'listTaskWatchers',
        'followTaskWatcher',
        'unfollowTaskWatcher',
        'listTaskDependencies',
        'createTaskDependency',
        'getTaskDependency',
        'deleteTaskDependency',
        'listDependencyCandidates',
        'duplicateList',
        'listSavedViews',
        'createSavedView',
        'getSavedView',
        'updateSavedView',
        'deleteSavedView',
        'duplicateSavedView',
        'listSpaceMilestones',
        'listSpaceCustomFields',
        'createSpaceCustomField',
        'getSpaceCustomField',
        'updateSpaceCustomField',
        'retireSpaceCustomField',
        'listListCustomFields',
        'listTaskTemplates',
        'createTaskTemplate',
        'getTaskTemplate',
        'deleteTaskTemplate',
        'listFavorites',
        'createFavorite',
        'getFavorite',
        'deleteFavorite',
        'listGoals',
        'createGoal',
        'getGoal',
        'updateGoal',
        'deleteGoal',
        'createGoalResult',
        'getGoalResult',
        'updateGoalResult',
        'deleteGoalResult',
        'getTeamDashboard',
        'getSprintReport',
        'getListWorkload',
        'getListTimesheet',
        'exportListTasks',
        'getIntakeFormConfiguration',
        'updateIntakeFormConfiguration',
        'publishIntakeForm',
        'disableIntakeForm',
        'getTaskIntakeContact',
        'listTaskAttachments',
        'getTaskAttachment',
        'startTaskAttachmentUpload',
        'completeTaskAttachmentUpload',
        'getTaskAttachmentDownload',
        'deleteTaskAttachment',
      ].sort(),
    );
  });

  it.each([
    'getPublicIntakeForm',
    'submitPublicIntakeForm',
    'startPublicIntakeAttachmentUpload',
    'completePublicIntakeAttachmentUpload',
    'abandonPublicIntakeAttachmentUpload',
  ])('%s accepts anonymous requests without an organization', (operationId) => {
    const route = served.find(
      (candidate: ServedRoute) => candidate.security?.operationId === operationId,
    );
    expect(route?.security).toEqual({ operationId, security: [], organization: false });
  });
});

describe('reading an operation security', () => {
  const memberRead: OperationSecurity = {
    operationId: 'listMembers',
    security: [{ sessionCookie: [] }, { apiToken: ['members:read'] }],
    organization: true,
  };
  const signOut: OperationSecurity = {
    operationId: 'signOut',
    security: [{ sessionCookie: [] }, {}],
    organization: false,
  };
  const signIn: OperationSecurity = { operationId: 'signIn', security: [], organization: false };

  it('tells whether an operation reads a credential', () => {
    expect(needsCredential(memberRead)).toBe(true);
    expect(needsCredential(signIn)).toBe(false);
  });

  it('tells whether the credential is optional', () => {
    expect(credentialIsOptional(signOut)).toBe(true);
    expect(credentialIsOptional(memberRead)).toBe(false);
  });

  it('tells whether a session is accepted', () => {
    expect(acceptsSession(memberRead)).toBe(true);
    expect(acceptsSession(signIn)).toBe(false);
  });

  it('reads the scopes a token needs, or none when no token is accepted', () => {
    expect(apiTokenScopesOf(memberRead)).toEqual(['members:read']);
    expect(apiTokenScopesOf(signOut)).toBeUndefined();
  });
});
