/** Transport for the goal operations provided by task-service. */
export interface GoalRegistry {
  // #region Methods
  /** Lists goals and their quarter summary. */
  listGoals(query: object): Promise<object>;

  /** Creates one goal. */
  createGoal(
    today: string,
    body: object,
    key: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Reads a goal. */
  getGoal(goalId: string, today: string): Promise<{ body: object; version: number }>;

  /** Updates a goal. */
  updateGoal(
    goalId: string,
    today: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Deletes a goal. */
  deleteGoal(goalId: string, ifMatch: string | undefined): Promise<void>;

  /** Creates a result. */
  createGoalResult(
    goalId: string,
    body: object,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Reads a result. */
  getGoalResult(goalId: string, resultId: string): Promise<{ body: object; version: number }>;

  /** Updates a result. */
  updateGoalResult(
    goalId: string,
    resultId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Deletes a result. */
  deleteGoalResult(goalId: string, resultId: string, ifMatch: string | undefined): Promise<void>;
  // #endregion
}
