import { createDecorator } from '../../di';
import type { ReferenceSummary, ReferenceDetail, SearchResult } from './types';

export interface IReferenceService {
  readonly _serviceBrand: undefined;

  /** Initialize the service for the given working directory */
  initialize(cwd: string): Promise<void>;

  /** List all active references for the current project */
  listActive(): Promise<ReferenceSummary[]>;

  /** Get full detail for a specific reference */
  get(packageName: string): Promise<ReferenceDetail | undefined>;

  /** Search within a reference's source code */
  search(packageName: string, query: string): Promise<SearchResult[]>;

  /** Re-index references (optionally a specific one) */
  refresh(packageName?: string): Promise<void>;

  /** Clear cached references (optionally a specific one) */
  clear(packageName?: string): Promise<void>;

  /** Get formatted summary string for system prompt injection */
  getSummary(): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const IReferenceService = createDecorator<IReferenceService>('referenceService');
