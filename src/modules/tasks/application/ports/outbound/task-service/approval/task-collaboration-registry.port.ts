/** Validated transport for task approvals and caller onboarding. */
export interface TaskCollaborationRegistry {
  // #region Methods
  /** Reads the current approval round. */
  getTaskApproval(taskKey: string): Promise<{ body: object; version: number }>;

  /** Opens a new approval round. */
  requestTaskApproval(
    taskKey: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Casts the caller's vote. */
  voteOnTaskApproval(
    taskKey: string,
    roundId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Withdraws the caller's vote. */
  withdrawTaskApprovalVote(
    taskKey: string,
    roundId: string,
    ifMatch: string | undefined,
  ): Promise<{ version: number }>;

  /** Reads the verified caller's progress. */
  getOnboarding(userId: string): Promise<{ body: object; version: number }>;

  /** Saves the caller's wizard. */
  updateOnboarding(
    userId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Saves the caller's checklist. */
  updateOnboardingChecklist(
    userId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ body: object; version: number }>;

  /** Finishes provisioning on task-service. */
  finishOnboarding(
    userId: string,
    body: object,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<{ body: object; version: number }>;
  // #endregion
}
