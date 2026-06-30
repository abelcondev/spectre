import { createDecorator } from '../../di';
import type { KnowledgeConcept, KnowledgeSearchResult } from './types';

export interface IKnowledgeService {
  readonly _serviceBrand: undefined;

  /** Index the OKF knowledge bundle (`sdd/`) for the given working directory. */
  initialize(cwd: string): Promise<void>;

  /** List the indexed concepts (frontmatter metadata only). */
  listConcepts(): Promise<KnowledgeConcept[]>;

  /** Search the bundle's text, optionally scoped to a concept `type`. */
  search(query: string, type?: string): Promise<KnowledgeSearchResult[]>;

  /** Formatted concept index for system-prompt injection (empty when no bundle). */
  getSummary(): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const IKnowledgeService = createDecorator<IKnowledgeService>('knowledgeService');
