import { promises as fsp } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { load as loadYaml } from 'js-yaml';

import { IKnowledgeService } from './knowledge';
import type { KnowledgeConcept, KnowledgeSearchResult } from './types';

const BUNDLE_DIRNAME = 'sdd';
const MAX_SEARCH_RESULTS = 30;
// Files that are bundle scaffolding, not searchable knowledge content on their own.
const NON_CONCEPT_FILES = new Set(['index.md', 'log.md']);

/**
 * Minimal logging surface, mirroring the reference service so the knowledge
 * service does not depend on the DI container.
 */
export interface KnowledgeLogger {
  debug(message: string, payload?: object): void;
  warn(message: string, payload?: object): void;
}

const noopLogger: KnowledgeLogger = {
  debug() {},
  warn() {},
};

export class KnowledgeService implements IKnowledgeService {
  readonly _serviceBrand: undefined;

  // Directory that contains the `sdd/` bundle — relative paths are reported
  // against this so they read as `sdd/tasks/login.md`.
  private relativeBase: string | undefined;
  private bundleDir: string | undefined;
  private concepts: KnowledgeConcept[] = [];
  // All markdown files in the bundle (relative paths), searched when no type filter.
  private allFiles: string[] = [];

  constructor(private readonly logger: KnowledgeLogger = noopLogger) {}

  async initialize(cwd: string): Promise<void> {
    this.relativeBase = undefined;
    this.bundleDir = undefined;
    this.concepts = [];
    this.allFiles = [];

    const bundleDir = await findBundleDir(cwd);
    if (!bundleDir) {
      this.logger.debug('no sdd/ bundle found; knowledge service inactive', { cwd });
      return;
    }
    this.bundleDir = bundleDir;
    this.relativeBase = dirname(bundleDir);

    const files = await collectMarkdownFiles(bundleDir);
    const concepts: KnowledgeConcept[] = [];
    const allFiles: string[] = [];

    for (const abs of files) {
      const rel = relative(this.relativeBase, abs);
      allFiles.push(rel);

      const base = abs.slice(bundleDir.length + 1);
      if (NON_CONCEPT_FILES.has(base)) continue;

      let content: string;
      try {
        content = await fsp.readFile(abs, 'utf8');
      } catch {
        continue;
      }
      const fm = parseFrontmatter(content);
      if (!fm) continue;
      const type = typeof fm['type'] === 'string' ? fm['type'].trim() : '';
      if (type.length === 0) continue;

      concepts.push({
        type,
        title: asString(fm['title']),
        description: asString(fm['description']),
        status: asString(fm['status']),
        tags: asStringArray(fm['tags']),
        path: rel,
      });
    }

    this.concepts = concepts;
    this.allFiles = allFiles;
    this.logger.debug('knowledge service initialized', {
      bundleDir,
      concepts: concepts.length,
      files: allFiles.length,
    });
  }

  async listConcepts(): Promise<KnowledgeConcept[]> {
    return [...this.concepts];
  }

  async search(query: string, type?: string): Promise<KnowledgeSearchResult[]> {
    if (!this.relativeBase || this.allFiles.length === 0) return [];
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];

    const scoped =
      type !== undefined
        ? this.concepts.filter((c) => c.type.toLowerCase() === type.toLowerCase()).map((c) => c.path)
        : this.allFiles;

    const results: KnowledgeSearchResult[] = [];
    for (const rel of scoped) {
      let content: string;
      try {
        content = await fsp.readFile(join(this.relativeBase, rel), 'utf8');
      } catch {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.toLowerCase().includes(needle)) {
          results.push({ file: rel, line: i + 1, snippet: lines[i]!.trim() });
          if (results.length >= MAX_SEARCH_RESULTS) return results;
        }
      }
    }
    return results;
  }

  async getSummary(): Promise<string> {
    if (this.concepts.length === 0) return '';

    const byType = new Map<string, KnowledgeConcept[]>();
    for (const concept of this.concepts) {
      const group = byType.get(concept.type) ?? [];
      group.push(concept);
      byType.set(concept.type, group);
    }

    const lines: string[] = [
      '## Project Knowledge',
      '',
      'The project ships an OKF knowledge bundle under `sdd/`. These concepts are available — use the `Knowledge` tool to search them, or read a file directly for full detail.',
      '',
    ];
    for (const [type, group] of [...byType.entries()].toSorted((a, b) => a[0].localeCompare(b[0]))) {
      lines.push(`### ${type}`);
      for (const concept of group) {
        const desc = concept.description ? ` — ${concept.description}` : '';
        const status = concept.status ? ` [status: ${concept.status}]` : '';
        lines.push(`- \`${concept.path}\`${desc}${status}`);
      }
      lines.push('');
    }
    return lines.join('\n').trimEnd();
  }

  dispose(): void {
    this.relativeBase = undefined;
    this.bundleDir = undefined;
    this.concepts = [];
    this.allFiles = [];
  }

  static createStandalone(logger?: KnowledgeLogger): KnowledgeService {
    return new KnowledgeService(logger);
  }
}

// -- Module-level helpers --

/** Walk up from `cwd` to the first ancestor that has an `sdd/` directory. */
async function findBundleDir(cwd: string): Promise<string | undefined> {
  let current = cwd;
  while (true) {
    const candidate = join(current, BUNDLE_DIRNAME);
    try {
      const st = await fsp.stat(candidate);
      if (st.isDirectory()) return candidate;
    } catch {
      // not here; keep walking up
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fsp.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

/** Extract the YAML frontmatter object from a markdown document, if present. */
function parseFrontmatter(content: string): Record<string, unknown> | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(content);
  if (!match) return undefined;
  try {
    const parsed = loadYaml(match[1]!);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v): v is string => typeof v === 'string');
  return strings.length > 0 ? strings : undefined;
}
