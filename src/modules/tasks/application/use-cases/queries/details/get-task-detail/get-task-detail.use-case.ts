import type { TaskDetail } from '../../../../models/details/task-detail.model.js';
import type { TaskServiceDocument } from '../../../../models/task-service/task-service-document.model.js';
import type { TaskDetailPart } from '../../../../ports/outbound/detail-parts/details/task-detail-part.port.js';
import type { TaskDetailCoreSource } from '../../../../ports/outbound/task-service/details/task-detail-core-source.port.js';

/**
 * Constant PART_DEADLINE_MS
 *
 * @description
 * How long a secondary part of the detail may take, in milliseconds (the default of the aggregate
 * policy): past it, the call is canceled and the part is named in `partial`.
 *
 * @type {number}
 */
const PART_DEADLINE_MS: number = 800;

/**
 * Class GetTaskDetail
 *
 * @description
 * Composes the detail of a task: the core of task-service and the secondary parts, read together.
 * The core is the main part: its failure fails the detail, as task-service answered it. A
 * secondary part that fails or does not answer within `PART_DEADLINE_MS` is named in `partial`
 * and left out. The comments page is a secondary part owned by task-service. The core failure takes precedence over every secondary result.
 */
export class GetTaskDetail {
  // #region Properties
  /**
   * Property core
   *
   * @description
   * The main part, from task-service.
   *
   * @type {TaskDetailCoreSource}
   * @readonly
   */
  private readonly core: TaskDetailCoreSource;

  /**
   * Property parts
   *
   * @description
   * The secondary parts, in the order `partial` names them.
   *
   * @type {readonly TaskDetailPart[]}
   * @readonly
   */
  private readonly parts: readonly TaskDetailPart[];
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the sources of the detail.
   *
   * @param {TaskDetailCoreSource} core - The main part, from task-service.
   * @param {readonly TaskDetailPart[]} parts - The secondary parts.
   * @constructor
   */
  public constructor(core: TaskDetailCoreSource, parts: readonly TaskDetailPart[]) {
    this.core = core;
    this.parts = parts;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Reads the core and every secondary part in parallel. If the core fails, cancels any
   * outstanding secondary reads and returns the core error immediately.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskDetail>} The detail, with the parts that could not be read named.
   * @throws {unknown} What the core source threw: the detail fails as a whole.
   */
  public async execute(taskKey: string): Promise<TaskDetail> {
    const pendingCore = this.core.getTaskDetail(taskKey);
    const abortParts = new AbortController();
    const pendingParts = Promise.allSettled(
      this.parts.map((part) => this.readPart(part, taskKey, abortParts.signal)),
    );
    const core = await pendingCore.catch((error: unknown) => {
      abortParts.abort();
      throw error;
    });
    const answers = await pendingParts;
    const parts: Map<string, TaskServiceDocument> = new Map<string, TaskServiceDocument>();
    const partial: string[] = [];
    for (const answer of answers) {
      if (answer.status === 'rejected') {
        throw answer.reason;
      }
      const [name, document] = answer.value;
      if (document === undefined) {
        partial.push(name);
      } else {
        parts.set(name, document);
      }
    }
    return { core, parts, partial };
  }

  /**
   * Method readPart
   *
   * @description
   * Reads one secondary part within `PART_DEADLINE_MS`. A failure or a late answer names the
   * part in `partial`, unless the source requires the detail to fail.
   *
   * @param {TaskDetailPart} part - The part.
   * @param {string} taskKey - Key of the task.
   * @param {AbortSignal} abortParts - Cancels all secondary reads on core failure.
   * @returns {Promise<readonly [string, TaskServiceDocument | undefined]>} The name of the part
   * and its document, or `undefined` when it could not be read.
   */
  private async readPart(
    part: TaskDetailPart,
    taskKey: string,
    abortParts: AbortSignal,
  ): Promise<readonly [string, TaskServiceDocument | undefined]> {
    const deadline = new AbortController();
    const signal = AbortSignal.any([abortParts, deadline.signal]);
    let finish = (): void => undefined;
    const canceled = new Promise<undefined>((resolve) => {
      finish = () => {
        resolve(undefined);
      };
    });
    signal.addEventListener('abort', finish, { once: true });
    const timer = setTimeout(() => {
      deadline.abort();
    }, PART_DEADLINE_MS);
    try {
      return [part.name, await Promise.race([part.read(taskKey, signal), canceled])];
    } catch (error) {
      if (!signal.aborted && part.failsDetail?.(error) === true) {
        throw error;
      }
      return [part.name, undefined];
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
    }
  }
  // #endregion
}
