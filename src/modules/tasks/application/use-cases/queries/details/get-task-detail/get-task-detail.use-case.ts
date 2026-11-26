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

/** The answer of one secondary read: its name and document, or what failed the detail. */
type PartAnswer = PromiseSettledResult<readonly [string, TaskServiceDocument | undefined]>;

/**
 * Settles a secondary read as soon as it ends, so that a read rejected while the core is still
 * pending is never reported as an unhandled rejection.
 *
 * @param {Promise<readonly [string, TaskServiceDocument | undefined]>} read - The read.
 * @returns {Promise<PartAnswer>} Its settled answer.
 */
function settle(
  read: Promise<readonly [string, TaskServiceDocument | undefined]>,
): Promise<PartAnswer> {
  return read.then(
    (value): PartAnswer => ({ status: 'fulfilled', value }),
    (reason: unknown): PartAnswer => ({ status: 'rejected', reason }),
  );
}

/**
 * Class GetTaskDetail
 *
 * @description
 * Composes the detail of a task: the core of task-service and the secondary parts, read together.
 * The core is the main part: its failure fails the detail, as task-service answered it. A
 * secondary part that fails or does not answer within `PART_DEADLINE_MS` is named in `partial`
 * and left out. The comments page is a secondary part owned by task-service, read with the core.
 * The Git links (`development`) are read from integration-service after the core, which is what
 * authorizes the actor to read the task. The core failure takes precedence over every secondary
 * result.
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
   * Reads the core and the secondary parts in parallel, then the parts bound `afterCore` once
   * the core has answered. If the core fails, cancels any outstanding secondary reads, starts no
   * other, and returns the core error immediately. If a parallel part has already failed the
   * detail when the core answers, cancels the outstanding reads, starts no part bound after the
   * core and returns that failure.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<TaskDetail>} The detail, with the parts that could not be read named.
   * @throws {unknown} What the core source threw: the detail fails as a whole.
   */
  public async execute(taskKey: string): Promise<TaskDetail> {
    const pendingCore = this.core.getTaskDetail(taskKey);
    const abortParts = new AbortController();
    let denial: PartAnswer | undefined;
    const withCore = this.parts.map((part) =>
      part.afterCore === true
        ? undefined
        : settle(this.readPart(part, taskKey, abortParts.signal)).then((answer) => {
            denial ??= answer.status === 'rejected' ? answer : undefined;
            return answer;
          }),
    );
    const core = await pendingCore.catch((error: unknown) => {
      abortParts.abort();
      throw error;
    });
    // A parallel part that already failed the detail (a visibility denial) makes a read after
    // the core pointless: fail now, without starting it.
    if (denial?.status === 'rejected') {
      abortParts.abort();
      throw denial.reason;
    }
    const answers = await Promise.all(
      this.parts.map(
        (part, index) => withCore[index] ?? settle(this.readPart(part, taskKey, abortParts.signal)),
      ),
    );
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
