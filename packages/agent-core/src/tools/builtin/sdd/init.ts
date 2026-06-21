/**
 * SddInitTool — install the SDD framework into the current Git repository.
 *
 * The framework files are bundled as static assets so Specter can bootstrap
 * SDD offline, without fetching from GitHub.
 */

import type { Kaos } from '@moonshot-ai/kaos';
import { join } from 'pathe';
import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import type { ExecutableToolResult, ToolExecution } from '../../../loop/types';
import { toInputJsonSchema } from '../../support/input-schema';
import { SDD_ASSETS, SDD_EMPTY_DIRS } from './sdd-assets';
import {
  commitSddFramework,
  ensureMainBranch,
  findProjectRoot,
  hasMainOrMasterBranch,
  initGitRepo,
  pathExists,
  runCommand,
} from './sdd-utils';
import DESCRIPTION from './init.md?raw';

const ProductAnswersSchema = z.object({
  name: z.string().describe('Product or project name.'),
  vision: z.string().describe('One or two sentences describing what the product is and why it exists.'),
  problem: z.string().optional().describe('The problem the product solves for its users.'),
  users: z.string().optional().describe('Primary users or personas.'),
  value: z.string().optional().describe('Core value proposition.'),
  language: z.string().optional().describe('Primary programming language (e.g. TypeScript, Python).'),
  framework: z.string().optional().describe('Main framework (e.g. SvelteKit, Next.js, Django).'),
  database: z.string().optional().describe('Database (e.g. PostgreSQL, SQLite).'),
  ui: z.string().optional().describe('UI library or styling approach (e.g. Tailwind, Material UI).'),
  package_manager: z.string().optional().describe('Package manager (e.g. pnpm, npm, poetry).'),
  test_types: z
    .array(z.string())
    .optional()
    .describe('Required test types (e.g. unit, integration, e2e).'),
  deployment: z.string().optional().describe('Deployment approach (e.g. Vercel, Docker, manual).'),
});

export const SddInitInputSchema = z.object({
  force: z
    .boolean()
    .optional()
    .describe('Overwrite existing SDD files if they already exist.'),
  product_answers: ProductAnswersSchema.optional().describe(
    'Answers that populate sdd/product.md and seed architecture/conventions templates.',
  ),
});

export type SddInitInput = z.infer<typeof SddInitInputSchema>;
export type ProductAnswers = z.infer<typeof ProductAnswersSchema>;

export class SddInitTool implements BuiltinTool<SddInitInput> {
  readonly name = 'SddInit' as const;
  readonly description = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(SddInitInputSchema);

  constructor(
    private readonly kaos: Kaos,
    private readonly cwd: string,
  ) {}

  resolveExecution(args: SddInitInput): ToolExecution {
    return {
      description: 'Installing SDD framework into the current project',
      approvalRule: this.name,
      execute: () => this.execution(args),
    };
  }

  private async execution(args: SddInitInput): Promise<ExecutableToolResult> {
    let repoRoot = await findProjectRoot(this.kaos, this.cwd);

    if (repoRoot === null) {
      const initResult = await initGitRepo(this.kaos, this.cwd);
      if (initResult.exitCode !== 0) {
        return {
          isError: true,
          output: `Could not initialize a Git repository in ${this.cwd}:\n${initResult.stderr}`,
        };
      }
      repoRoot = this.cwd;
    }

    // Refuse to install into a parent repository that is not the current directory.
    // This avoids polluting the user's home directory or an unrelated monorepo root
    // when the agent is running inside a new project folder.
    if (repoRoot !== this.cwd) {
      return {
        isError: true,
        output:
          `The current directory (${this.cwd}) is inside a Git repository rooted at ${repoRoot}.\n` +
          'To keep SDD scoped to this project, initialize a new Git repo here first:\n' +
          `  cd "${this.cwd}" && git init\n` +
          'Then run SddInit again.',
      };
    }

    const sddDir = join(repoRoot, 'sdd');
    if (!args.force && (await pathExists(this.kaos, sddDir))) {
      return {
        isError: true,
        output:
          'SDD is already installed in this project. Pass force=true to overwrite, or run SddStatus to verify.',
      };
    }

    const productPath = join(repoRoot, 'sdd/product.md');
    const needsProduct = !(await pathExists(this.kaos, productPath));
    if (needsProduct && args.product_answers === undefined) {
      return {
        isError: true,
        output: this.productDiscoveryPrompt(),
      };
    }

    const written: string[] = [];
    for (const asset of SDD_ASSETS) {
      const targetPath = join(repoRoot, asset.path);
      await this.kaos.mkdir(join(targetPath, '..'), { parents: true, existOk: true });
      let content = asset.content;
      if (args.product_answers !== undefined) {
        content = applyProductAnswers(content, asset.path, args.product_answers);
      }
      await this.kaos.writeText(targetPath, content);
      if (asset.executable) {
        await runCommand(this.kaos, repoRoot, ['chmod', '+x', targetPath]);
      }
      written.push(asset.path);
    }

    for (const dir of SDD_EMPTY_DIRS) {
      await this.kaos.mkdir(join(repoRoot, dir), { parents: true, existOk: true });
    }

    const hasBaseBranch = await hasMainOrMasterBranch(this.kaos, repoRoot);
    if (!hasBaseBranch) {
      const branchResult = await ensureMainBranch(this.kaos, repoRoot);
      if (branchResult.exitCode !== 0) {
        return {
          isError: false,
          output:
            `SDD files written to ${repoRoot}, but could not create the main branch:\n${branchResult.stderr}\n\n` +
            `Written files:\n${written.map((p) => `  ${p}`).join('\n')}`,
        };
      }
    }

    const commitResult = await commitSddFramework(this.kaos, repoRoot);
    if (commitResult.exitCode !== 0) {
      return {
        isError: false,
        output:
          `SDD files written to ${repoRoot}, but could not commit them:\n${commitResult.stderr}\n\n` +
          `Written files:\n${written.map((p) => `  ${p}`).join('\n')}`,
      };
    }

    return {
      output:
        `SDD framework installed and committed in ${repoRoot}.\n` +
        `${written.length} files committed on branch main.\n\n` +
        `Product defined in sdd/product.md.\n` +
        'Next: create a feature project with `spectre sdd worktree create <feature-slug>`.',
    };
  }

  private productDiscoveryPrompt(): string {
    return (
      'A global product definition is required before installing the SDD framework.\n' +
      'Please ask the human the following questions and call SddInit again with `product_answers`.\n\n' +
      'Discovery questions:\n' +
      '1. What is the product/project name?\n' +
      '2. What is the product vision? (one or two sentences)\n' +
      '3. What problem does it solve? (optional)\n' +
      '4. Who are the primary users? (optional)\n' +
      '5. What is the core value proposition? (optional)\n' +
      '6. What is the primary programming language? (optional)\n' +
      '7. What is the main framework? (optional)\n' +
      '8. What database will you use? (optional)\n' +
      '9. What UI library or styling approach will you use? (optional)\n' +
      '10. What package manager will you use? (optional)\n' +
      '11. What test types are required? (optional array, e.g. ["unit", "integration", "e2e"])\n' +
      '12. How will the product be deployed? (optional)\n\n' +
      'Example product_answers:\n' +
      '{\n' +
      '  "name": "Acme Tasks",\n' +
      '  "vision": "A minimal task manager for small engineering teams.",\n' +
      '  "problem": "Teams lose track of tasks across scattered tools.",\n' +
      '  "users": "Small engineering teams and tech leads",\n' +
      '  "value": "A single source of truth for team tasks and priorities.",\n' +
      '  "language": "TypeScript",\n' +
      '  "framework": "SvelteKit",\n' +
      '  "database": "PostgreSQL",\n' +
      '  "ui": "Tailwind CSS",\n' +
      '  "package_manager": "pnpm",\n' +
      '  "test_types": ["unit", "integration", "e2e"],\n' +
      '  "deployment": "Vercel"\n' +
      '}'
    );
  }
}

function applyProductAnswers(
  content: string,
  assetPath: string,
  answers: ProductAnswers,
): string {
  if (assetPath === 'sdd/product.md') {
    return content
      .replaceAll('{name}', answers.name)
      .replaceAll('{vision}', answers.vision)
      .replaceAll('{problem}', answers.problem ?? '_To be completed._')
      .replaceAll('{users}', answers.users ?? '_To be completed._')
      .replaceAll('{value}', answers.value ?? '_To be completed._');
  }

  if (assetPath === 'sdd/architecture.md') {
    let result = content;
    if (answers.framework) {
      result = result.replace(
        '- **Framework**: *(e.g. SvelteKit, Next.js, Django, etc.)*',
        `- **Framework**: ${answers.framework}`,
      );
    }
    if (answers.language) {
      result = result.replace(
        '- **Language**: *(e.g. TypeScript, Python, Ruby, Go, etc.)*',
        `- **Language**: ${answers.language}`,
      );
    }
    if (answers.database) {
      result = result.replace(
        '- **Database**: *(e.g. PostgreSQL, SQLite, InstantDB, etc.)*',
        `- **Database**: ${answers.database}`,
      );
    }
    if (answers.ui) {
      result = result.replace(
        '- **UI Components / Styles**: *(e.g. Tailwind, Material UI, CSS modules, etc.)*',
        `- **UI Components / Styles**: ${answers.ui}`,
      );
    }
    if (answers.package_manager) {
      result = result.replace(
        '- **Package Manager**: *(e.g. bun, npm, pnpm, poetry, etc.)*',
        `- **Package Manager**: ${answers.package_manager}`,
      );
    }
    return result;
  }

  if (assetPath === 'sdd/conventions.md') {
    if (answers.language) {
      return content.replace(
        '- **Primary language**: *(complete)*',
        `- **Primary language**: ${answers.language}`,
      );
    }
  }

  return content;
}
