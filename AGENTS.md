# Repository-level Agent Guide — Specter

Reply in the same language as the user.

This is **Specter**, a fork of [Kimi Code](https://github.com/MoonshotAI/kimi-code) where the default agent is the **SDD orchestrator**. The SDD (Spec-Driven Development) workflow is native: the orchestrator profile is `sdd-orchestrator`, and the subagents are `sdd-tech-lead`, `sdd-product-manager`, `sdd-designer`, `sdd-tech-specifier`, `sdd-developer`, and `sdd-auditor`.

This file is the **entry point** for any agent working on this project. Read only what you need when you need it.

---

## 1. Before starting (mandatory)

In every session, the orchestrator agent MUST:

1. **Read `CLAUDE.md`** — enforces the orchestrator role.
2. **Read `sdd/README.md`** — understand the SDD flow.
3. **Check `sdd/features/`** — current state of features and issues.
4. **Run `init.sh` on demand** — when the user asks, before declaring `done`, or when there are changes that justify verifying the environment. Do not run it automatically at the start of every session.

---

## 2. Project map

| Path/File | Content | When to read |
|---|---|---|
| `CLAUDE.md` | Role enforcer + minimal stack | At the start |
| `AGENTS.md` | This file — map and hard rules | At the start |
| `sdd/README.md` | SDD index | Before any work |
| `sdd/workflow.md` | States, workflow, worktrees, golden rules | Before any work |
| `sdd/architecture.md` | **Template** for stack and architectural decisions | Before implementing |
| `sdd/conventions.md` | **Template** for style, naming, and language | Before writing code |
| `sdd/quality-gates.md` | Definition of Ready/Done, checklist C1–C7 | Before declaring done |
| `sdd/testing.md` | Testing strategy, TDD, fixtures, coverage | Before writing tests |
| `sdd/security.md` | Security, RBAC, PII, compliance | Before implementing features with sensitive data |
| `sdd/delivery.md` | Commits, PRs, merge, and closure | Before delivering |
| `sdd/decisions/` | ADRs (Architecture Decision Records) | When architectural decisions are made |
| `scripts/sdd-worktree.sh` | Worktree manager | When creating a feature |
| `scripts/sdd-move.sh` | Move issues between states | When changing state |
| `packages/agent-core/src/profile/sdd/` | Native SDD agent profiles | Never edit directly unless changing SDD orchestration |
| `sdd/features/` | Local projects, issues, and specs | Source of truth for the SDD flow |

### Monorepo layout

- `apps/kimi-code`: the CLI / TUI application. It consumes core capabilities through `@moonshot-ai/kimi-code-sdk` and must not depend directly on `@moonshot-ai/agent-core`. When writing or modifying its terminal UI, use the `write-tui` skill (`.agents/skills/write-tui/SKILL.md`).
- `apps/kimi-web`: the browser web UI, a peer to the TUI. Vue 3 + Vite + vue-i18n; talks to the server over REST + WebSocket under `/api/v1`. It must not depend directly on `@moonshot-ai/agent-core`.
- `apps/vis`, `apps/vis/server`, `apps/vis/web`: visual debugging tools for sessions and replays.
- `packages/agent-core`: the unified agent engine, including Agent, Session, profile, skills, tools, plan, permission, background, records, the in-process DI service layer (`src/services/`), and other core capabilities. **The SDD profiles live here.**
- `packages/node-sdk`: the public TypeScript SDK and harness.
- `packages/kosong`: the LLM / provider abstraction layer.
- `packages/kaos`: the execution environment and file/process abstractions.
- `packages/oauth`: Kimi OAuth and managed auth utilities.
- `packages/telemetry`: shared client-side telemetry infrastructure.
- `packages/server`: the Kimi Code server. Hosts `agent-core` sessions and exposes them over REST + WebSocket (`/api/v1`).
- `packages/server-e2e`: live e2e tests and scenarios against a running server.

---

## 3. Working principles

- Think from first principles. Start from real requirements, code facts, and verification results; if the goal is unclear, discuss it with the user first.
- Treat code, not documentation, as the source of truth. Unless the user explicitly says otherwise, do not read ordinary Markdown just to understand the implementation.
- Before making code changes, read the relevant code and the most recent constraints, and follow the nearest `AGENTS.md` in the directory tree.
- Keep changes focused. Do not slip in unrelated refactors along the way.
- When committing, do not add any co-author attribution, and do not reveal the identity of the agent in commit messages, PR descriptions, or any explanatory text.

---

## 4. Environment requirements

- **Node.js**: `>=24.15.0` (from the root `package.json` `engines`; `.nvmrc` is `24.15.0`).
- **pnpm**: `10.33.0` (from the root `package.json` `packageManager`).
- `pnpm install` will fail when the Node version is not satisfied, because `.npmrc` sets `engine-strict=true`.

---

## 5. Monorepo workspace maintenance

- `pnpm-workspace.yaml` is the source of truth for workspace membership, but `flake.nix` also contains **hardcoded** `workspacePaths` and `workspaceNames` lists.
- **Whenever you add or remove a workspace package, you MUST update both `pnpm-workspace.yaml` and `flake.nix` — for every package, including leaf / test / e2e packages that nothing depends on.**
  - `pnpm-workspace.yaml` uses globs (`packages/*`, `apps/*`), so most packages land there automatically; `flake.nix` is fully manual and is where omissions happen.
  - Missing a path in `flake.nix`'s `workspacePaths` will silently drop files from the Nix build's `src` fileset.
  - Missing a name in `flake.nix`'s `workspaceNames` will break `pnpmConfigHook` because dependencies for that workspace will not be fetched.
- The automated "Check flake.nix workspace sync" (`scripts/check-nix-workspace.mjs`) only validates the transitive dependency **closure of `@moonshot-ai/kimi-code`**. A leaf package outside that closure slips through even when it is missing from `flake.nix`. A green check is therefore NOT proof that `flake.nix` is fully in sync — keep it updated by hand on every add/remove.

---

## 6. General coding rules

- For optional object properties, pass `undefined` directly instead of using conditional spread.
  - YES: `{ user }`
  - NO: `{ ...(user ? { user } : undefined) }`
- Optional object properties do not need to additionally allow `undefined` in the type.
  - YES: `interface Options { user?: User }`
  - NO: `interface Options { user?: User | undefined }`
- Internal methods with only a single parameter should not be turned into options objects just for stylistic uniformity.
- Except for a package's `index.ts`, other `index.ts` files should prefer `export * from './module';`.
- The `Agent` class in `packages/agent-core/src/agent` must be usable on its own. The constructor must not force the caller to create a `Session` instance, nor require an `agentId` or `session`.
- Do not add too many new test files. Prefer adding tests to the existing test file of the corresponding component or module.
- When a test fails because of a user modification, default to fixing the test first; do not change the implementation to satisfy an old test unless the implementation truly has a bug.
- Do not sacrifice code quality for external compatibility unless the user explicitly asks for it. Breaking changes go through changesets and a `major` bump, gated by the rule below.
- Prefer importing via `import ... from '#/...'`, which serves the same purpose as `import ... from '@/...'`.

---

## 7. SDD hard rules

Non-negotiable rules:

- **Each feature is a Project in `sdd/features/<slug>/`**, with at least one Issue `[Product]`, one `[Design]`, and one `[Dev]`.
- **Each feature lives in its own worktree** from the start: `<main-repo>-<feature-slug>/`.
- **Only one Issue `[Dev]` in `Implementing` or `Review` at a time**.
- **Do not declare `done` without a green `init.sh`**.
- **Do not skip human gates**:
  1. `Spec Needed` → `Designing` (approval of the functional/UI spec).
  2. `Designing` → `Design Ready` (approval of the UI design).
  3. `Spec Ready` → `Implementing` (approval of the technical spec).
  4. `Review` → `Testing` (approval of the review/merge).
- **Issue `[Design]` is considered closed when it reaches `Design Ready`**.
- **Issue `[Dev]` does not advance until Issue `[Design]` is in `Design Ready`**.
- **Tests before implementation (TDD)**. Each `R<n>` generates at least one red test before code.
- **Do not edit production code directly from the orchestrator**. The orchestrator orchestrates; the developer writes code.
- **Every important change is recorded**, not only in chat: in `sdd/features/` (state, Issue/Project description), or in `sdd/decisions/` when it affects architecture.
- **`sdd/` is the source of truth** for state, specs, and tasks. There is no local `feature_list.yaml` nor `specs/` folder.
- **No Issue `[Dev]` with UI moves to `Implementing` without an approved design in `[Design]`**.
- **Leave the repo clean when closing**. No temporary files or orphan branches.

---

## 8. Local SDD workflow

`sdd/` is the source of truth. See `sdd/workflow.md` for full details.

### Entities

```text
sdd/features/<feature-slug>/ = Feature (e.g., "login-y-dashboard-layout")
  ├── README.md = context, scope, and out-of-scope of the feature
  ├── product/
  │   ├── discovery/     = issues with product spec pending
  │   └── product-ready/ = approved issues
  ├── design/
  │   ├── spec-needed/   = issues with functional/UI spec pending
  │   ├── designing/     = issues iterating UI design
  │   └── design-ready/  = approved issues
  └── dev/
      ├── backlog/       = issues blocked by [Design]
      ├── spec-needed/   = issues with technical spec pending
      ├── spec-ready/    = issues with complete technical spec (awaiting approval)
      ├── implementing/  = issues in implementation
      ├── blocked/       = issues paused due to external blocker
      ├── review/        = issues in review
      ├── rejected/      = issues rejected in review (rework)
      ├── testing/       = merged issues, in final validation
      ├── done/          = completed issues
      └── cancelled/     = discarded issues
```

### States

**Issue `[Product]`**:

```text
discovery → product-ready
```

**Issue `[Design]`**:

```text
spec-needed → designing → design-ready
```

**Issue `[Dev]`**:

```text
backlog → spec-needed → spec-ready → implementing → review → testing → done
                      ↓         ↓           ↓              ↑
                  blocked   blocked     blocked      rejected
                                    cancelled
```

### Responsibilities by phase

| Phase | Responsible | Action |
|---|---|---|
| Idea | Human/Orchestrator | Create feature worktree with `./scripts/sdd-worktree.sh create <feature-slug>`. |
| Product Discovery | sdd-product-manager | Interview the human with `AskUserQuestion` and write product spec + BDD in Issue `[Product]`. |
| Product review | Human | Approve product spec. Orchestrator moves file to `product/product-ready/`. |
| Spec Design | sdd-designer | Interview the human with `AskUserQuestion` and write functional + UI/UX spec in Issue `[Design]`. |
| Spec review | Human | Approve functional/UI spec. Orchestrator moves file to `design/designing/`. |
| UI Design | Human/Assisted agent | Iterate in the project's design tool. Update assets in Issue `[Design]`. |
| Design review | Human | Approve design. Orchestrator moves file to `design/design-ready/`. |
| Spec Dev | sdd-tech-specifier | Write technical spec + Test Plan + Impact Analysis in Issue `[Dev]` file. |
| Spec technical review | Human | Approve technical spec. Orchestrator moves to `dev/implementing/`. |
| Implementation | sdd-developer | Run TDD: write red tests, minimum implementation, refactor. Write code in the project. |
| Review | sdd-auditor | Audit against `sdd/quality-gates.md` C1–C7 and `sdd/security.md`. |
| Closure | Orchestrator | Merge the worktree into `main`, remove worktree, move file to `dev/done/`. |

---

## 9. Session close lifecycle

Before declaring a session closed:

1. Run `init.sh`. It must print `[OK] SDD harness ready`.
2. If an Issue `[Dev]` was finished, make sure its file is in `dev/done/`.
3. If an Issue `[Design]` was closed, make sure its file is in `design/design-ready/`.
4. Update `sdd/README.md` and `sdd/workflow.md` with the current state of projects.
5. Make sure there are no suspicious untracked files.

---

## 10. If blocked

If an agent gets blocked:

1. Re-read the relevant docs.
2. Move the Issue to `dev/blocked/` with `./scripts/sdd-move.sh`.
3. Document the blocker as a comment in the corresponding Issue in `sdd/features/` (`[Design]` or `[Dev]`).
4. Stop the session. Do not invent workarounds.

---

## 11. Experimental features

- Gate a not-yet-public feature behind an experimental flag. Add the flag to the registry at `packages/agent-core/src/flags/registry.ts`, then check it with `flags.enabled('my-feature')`. Flags are env-driven and default off: `KIMI_CODE_EXPERIMENTAL_<NAME>` toggles one, `KIMI_CODE_EXPERIMENTAL_FLAG` enables all. Release by flipping the entry's `default` to `true`.

---

## 12. Where to update instructions

- Hard rules that affect almost every task: update the root `AGENTS.md`.
- Rules that only affect a specific directory: update the nearest sub-directory `AGENTS.md`.
- Keep instruction updates focused and supported by code facts.
- When creating a PR, the PR title must follow Conventional Commit style, e.g. `chore: remove legacy format commands`.
- When an AI agent opens or updates a PR, fill in `.github/pull_request_template.md` — link the related issue or explain the problem, then describe what changed. Do not leave placeholder text or submit a generic summary of the diff.
- Do not submit vague AI-generated PR text. The human author must understand the change well enough to explain the code, edge cases, and why the approach fits this repository.
- After finishing a task and before submitting a PR, run the `gen-changesets` skill (see `.agents/skills/gen-changesets/SKILL.md`) and generate a changeset under `.changeset/` according to its rules.
- When generating a changeset, **never** decide on a `major` bump on your own. When you judge a change to meet the major criteria (breaking changes, incompatible user configuration, renamed or removed commands/arguments, changed behavior semantics, etc.), stop and explain it to the user and ask for confirmation. **Only write `major` after the user has explicitly agreed.** Otherwise default to `minor` (and fall back to `patch` if `minor` is unclear).
