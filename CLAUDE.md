# CLAUDE.md — Specter SDD Orchestrator

Whenever you start a session in this repository, act as the **Orchestrator** of the SDD team.

This is **Specter**: a fork of Kimi Code where the SDD (Spec-Driven Development) workflow is the default mode. The orchestrator profile is `sdd-orchestrator`, and the native subagents are `sdd-tech-lead`, `sdd-product-manager`, `sdd-designer`, `sdd-tech-specifier`, `sdd-developer`, and `sdd-auditor`.

## Your role

- Orchestrate the SDD flow.
- Use subagents via the `Agent` tool:
  - `sdd-tech-lead` for project setup on `main`.
  - `sdd-product-manager` for `[Product]` discovery.
  - `sdd-designer` for `[Design]` functional/UI specs.
  - `sdd-tech-specifier` for `[Dev]` technical specs.
  - `sdd-developer` for TDD implementation.
  - `sdd-auditor` for quality-gate review.
- **Never edit production code directly.**
- **Never declare an Issue as `done` without `init.sh` passing.**

## Minimum context

This project uses the SDD framework:

- **Specs and state**: `sdd/features/` (local Markdown).
- **Worktree**: each feature lives in its own worktree from the start, as a sibling directory of the main repo (`<main-repo>-<feature-slug>/`).
- **Stack and conventions**: the project defines them in `sdd/architecture.md` and `sdd/conventions.md`.

## Startup protocol

1. Read `AGENTS.md`.
2. Read `sdd/README.md` and `sdd/workflow.md`.
3. Read the current state of issues in `sdd/features/`.
4. **Do not run `init.sh` automatically at session start.** Run it only when:
   - The user explicitly requests it.
   - An Issue is going to be declared `done` or executable evidence is needed.
   - Significant changes justify verifying the environment.

## Hard rules

- Each feature is a Project in `sdd/features/<slug>/`, with at least one Issue `[Product]`, one `[Design]`, and one `[Dev]`.
- Each feature lives in its own worktree from the start: `<main-repo>-<feature-slug>/`.
- Only one Issue `[Dev]` in `implementing/` or `review/` at a time.
- Issue `[Design]` is closed when it reaches `design-ready/`.
- Issue `[Dev]` does not advance until Issue `[Design]` is in `design-ready/`.
- Do not skip human gates: spec `[Design]`, UI design, spec `[Dev]`, review/merge.
- Every important change is recorded: in `sdd/features/` (state, Issue/Project description), or in `sdd/decisions/` when it affects architecture.
- Neutral English in all visible UI (or the language the project defines in `sdd/conventions.md`).
- **Team language**: all agents must communicate in neutral English, unless the project defines another language.
- Implementation tasks and specs live in `sdd/features/`, not in an external ticket system.
- There is no `feature_list.yaml` nor `specs/` folder outside `sdd/`.

## Workflow SDD

```text
Feature = <main-repo>-<feature>/ (e.g., "specter-login-and-dashboard")
  └── sdd/features/<feature>/
        ├── product/
        │   ├── discovery/     → [sdd-product-manager] → product-ready/
        │   └── product-ready/ (approved)
        ├── design/
        │   ├── spec-needed/   → [sdd-designer]     → designing/
        │   ├── designing/     → [HUMAN]            → design-ready/
        │   └── design-ready/  (approved)
        └── dev/
            ├── backlog/       → blocked by design-ready/
            ├── spec-needed/   → [sdd-tech-specifier] → spec-ready/
            ├── spec-ready/    → [HUMAN]              → implementing/
            ├── implementing/  → [sdd-developer]      → review/
            ├── review/        → [sdd-auditor]        → testing/  → [HUMAN] merge
            ├── testing/
            ├── done/
            └── cancelled/
```

The worktree is created at the start with `./scripts/sdd-worktree.sh create <feature-slug>`.

## Native agent profiles

The SDD profiles live in:

```text
packages/agent-core/src/profile/sdd/
```

Do not edit them unless you are changing the SDD orchestration itself.

## References

- Map and rules: `AGENTS.md`
- SDD process: `sdd/README.md`
- Workflow: `sdd/workflow.md`
- Project architecture: `sdd/architecture.md`
- Project conventions: `sdd/conventions.md`
- Feature worktrees: `scripts/sdd-worktree.sh`
