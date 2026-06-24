# SDD — Software Design & Development

This directory is the **source of truth** for this project's SDD flow.

- **Specs** live in `sdd/features/`.
- The **state** of each issue is represented by the **folder** where its `.md` file is located.
- The SDD flow is **stack-agnostic**: it does not impose language, framework, or tooling. Each project completes `sdd/architecture.md`, `sdd/conventions.md`, and `sdd/tech-stack.md` with its own decisions. **Pencil.dev** is the default visual design tool.

---

## SDD Map

| File | Purpose |
|---|---|
| `sdd/README.md` | This index. |
| `sdd/product.md` | **Global product definition**. Vision, users, value proposition, and roadmap. |
| `sdd/brand.md` | **Brand and identity**. Colors, typography, tone of voice, visual style, terminology. |
| `sdd/workflow.md` | States, workflow, worktrees, golden rules. |
| `sdd/architecture.md` | **Template** for defining the project's stack, layers, and architectural decisions. |
| `sdd/conventions.md` | **Template** for defining code style, naming, and project conventions. |
| `sdd/quality-gates.md` | Definition of Ready/Done and C1–C7 checklist. |
| `sdd/testing.md` | Testing strategy, TDD, fixtures, coverage. |
| `sdd/security.md` | Security principles, RBAC, PII, compliance. |
| `sdd/troubleshooting.md` | Guide to common SDD framework problems and solutions. |
| `sdd/delivery.md` | Commits, PRs, merge, and closure. |
| `sdd/decisions/` | Project ADRs (Architecture Decision Records). |
| `sdd/templates/` | Templates for projects and issues. |
| `sdd/templates/issue-product.md` | Template for the `[Product]` Issue (BDD, product goals, acceptance criteria). |
| `sdd/features/` | Active projects and issues for individual features. |

---

## How to Start

1. **Product + Brand Discovery** (on `main`): Spectre guides the human through research, proposal, and brand-direction decisions. Once approved, it writes `sdd/product.md` and `sdd/brand.md`.
2. **Complete project setup on `main`** before creating any feature:
   - Fill `sdd/architecture.md` with the project's stack and architectural decisions. Set **Pencil.dev** as the visual design tool.
   - Fill `sdd/conventions.md` with style, naming, project conventions, and UI/copy conventions.
   - Fill `sdd/tech-stack.md` with the technology inventory, versions, MCPs, and doc URLs. Include the **Pencil.dev MCP**.
   - Launch `sdd-tech-lead` to orient the human on the technology, dependencies, architecture, and repo structure.
   - Let the Tech Lead create the project structure, including an empty placeholder `sdd/design-system/design-system.lib.pen`.
   - Build the Design System library freely in Pencil using `sdd/brand.md` as the source of truth; Spectre assists with operational tasks.
   - Install dependencies and configure GitHub.
3. Read `sdd/workflow.md` to understand the lifecycle.
4. Read `sdd/quality-gates.md`, `sdd/testing.md`, and `sdd/security.md` before declaring `done`.
5. Only after setup is complete, create a feature worktree from `main`:
   ```bash
   spectre sdd worktree create <feature-slug>
   ```
   No Issue files are created at this point.
6. Switch to the feature worktree and start Spectre there:
   ```bash
   cd <repo>-<feature-slug>
   spectre
   ```
7. Inside the worktree, Spectre detects the feature and guides the human step by step through **research**, **proposal + brand direction**, and the first Issue `[Product]`. The Issue is created only after the proposal is approved.
8. Move issues between states inside the worktree:
   ```bash
   spectre sdd move <feature-slug> <issue> <source-state> <target-state>
   ```

---

## Golden Rules (Summary)

- Only one `[Dev]` Issue in `implementing/` or `review/` at a time.
- `[Dev]` does not advance until `[Design]` is in `design/design-ready/`.
- `[Design]` does not advance until `[Product]` is in `product/product-ready/`.
- Tests before implementation (TDD).
- `spectre sdd status` green before declaring `done`.
- `sdd/` is the source of truth.
- The Orchestrator guides the human step by step in conversation; it does not use `TodoList` to manage the human flow.
- The human is the creative director in Pencil; Spectre assists only with operational tasks.

---

## Active Projects Index

| Feature | Product | Design | Dev | Worktree |
|---|---|---|---|---|
| *(none)* | — | — | — | — |

> For more detail, see `sdd/workflow.md`.
