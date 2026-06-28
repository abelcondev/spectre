export interface ReferenceSummary {
  readonly package: string;
  readonly version: string;
  readonly status: 'indexed' | 'pending' | 'error';
  readonly indexedAt?: string;
  readonly size?: number;
  readonly fileCount?: number;
  readonly source?: string;
}

export interface ReferenceDetail extends ReferenceSummary {
  readonly cachePath: string;
  readonly repo?: string;
  readonly summaryText: string;
}

export interface SearchResult {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
  readonly package: string;
  readonly version: string;
}

export interface CachedReference {
  readonly package: string;
  readonly version: string;
  readonly source: 'npm' | 'git' | 'local';
  readonly repo?: string;
  readonly clonedAt: string;
  readonly size: number;
  readonly fileCount: number;
  readonly indexedAt?: string;
}

export interface ReferenceManifest {
  readonly version: 1;
  readonly references: Record<string, CachedReference>;
}
