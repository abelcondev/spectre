# Repository-level Agent Guide — SDD Project

Reply in the same language as the user.

This project uses the **SDD (Spec-Driven Development)** workflow. The orchestrator is **Spectre** (default profile `agent`), and the native subagents are `sdd-tech-lead`, `sdd-product-manager`, `sdd-designer`, `sdd-tech-specifier`, `sdd-developer`, and `sdd-auditor`.

This file is the **entry point** for any agent working on this project. Read only what you need when you need it.

---

## 1. Before starting (mandatory)

In every session, the orchestrator agent MUST:

1. **Read `CLAUDE.md`** — enforces the orchestrator role.
2. **Read `sdd/README.md`** — understand the SDD flow.
3. **Check `sdd/features/`** — current state of features and issues.
4. **Run `spectre sdd status` on demand** — when the user asks, before declaring `done`, or when there are changes that justify verifying the environment. Do not run it automatically at the start of every session.

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
| `sdd/decisions/` | ADRs (Architecture Decision Records) | When architectural or product decisions are made |
| `sdd/tech-stack.md` | Technology inventory, versions, MCPs, doc URLs | Before implementing |
| `sdd/features/` | Local projects, issues, and specs | Source of truth for the SDD flow |

Complete `sdd/architecture.md` and `sdd/conventions.md` with this project's concrete stack, conventions, and quality commands.

---

## 3. Working principles

- Think from first principles. Start from real requirements, code facts, and verification results; if the goal is unclear, discuss it with the user first.
- Treat code, not documentation, as the source of truth. Unless the user explicitly says otherwise, do not read ordinary Markdown just to understand the implementation.
- Before making code changes, read the relevant code and the most recent constraints, and follow the nearest `AGENTS.md` in the directory tree.
- Keep changes focused. Do not slip in unrelated refactors along the way.
- When committing, do not add any co-author attribution, and do not reveal the identity of the agent in commit messages, PR descriptions, or any explanatory text.

---

## 4. SDD hard rules

Non-negotiable rules:

- **Each feature is a Project in `sdd/features/<slug>/`**, with at least one Issue `[Product]`, one `[Design]`, and one `[Dev]`.
- **Each feature lives in its own worktree** from the start: `<main-repo>-<feature-slug>/`.
- **Project setup and stack changes happen on `main`** via the `sdd-tech-lead`; they do not use a feature worktree.
- **Product-level changes use a `product/<change-slug>` branch + PR**; they do not use a feature worktree.
- **Only one Issue `[Dev]` in `Implementing` or `Review` at a time**.
- **Do not declare `done` without a green `spectre sdd status`**.
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
- **`sdd/` is the source of truth** for state, specs, and tasks.
- **No Issue `[Dev]` with UI moves to `Implementing` without an approved design in `[Design]`**.
- **Leave the repo clean when closing**. No temporary files or orphan branches.
