export interface KnowledgeConcept {
  /** OKF concept type, e.g. "Decision", "Task", "Proposal". */
  readonly type: string;
  readonly title?: string;
  readonly description?: string;
  readonly status?: string;
  readonly tags?: readonly string[];
  /** Path relative to the project root, e.g. "sdd/tasks/login.md". */
  readonly path: string;
}

export interface KnowledgeSearchResult {
  /** Path relative to the project root. */
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}
