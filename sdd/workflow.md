# SDD — Workflow, States, and Lifecycle

This document defines the SDD workflow, states, and rules.

For the general SDD index, see `sdd/README.md`.

---

## 1. Entities

- **Feature**: a business feature, represented by `sdd/features/<slug>/`.
- **Issue `[Product]`**: product discovery + BDD scenarios, `.md` file inside `sdd/features/<slug>/product/<state>/`. It is the first phase and unlocks `[Design]`.
- **Issue `[Design]`**: functional spec + UI/UX, `.md` file inside `sdd/features/<slug>/design/<state>/`. Blocked by `[Product]`.
- **Issue `[Dev]`**: technical spec + implementation, `.md` file inside `sdd/features/<slug>/dev/<state>/`. Blocked by `[Design]`.

---

## 1.1 Roles

| Role | Responsible for | SDD Phase |
|---|---|---|
| `orchestrator` | Create worktrees, move issues between states, orchestrate subagents, human gates. | Whole cycle |
| `product_manager` | Discovery, BDD, product goals, acceptance criteria, risks, scope. | `[Product]` |
| `designer` | Functional spec, user flows, UI/UX, accessibility, design tokens, handoff to Dev. | `[Design]` |
| `tech_specifier` | Technical spec, technical decisions, impact analysis, Test Plan. | `[Dev]` (spec) |
| `developer` | Implementation with TDD, production code. | `[Dev]` (implementation) |
| `auditor` | Verification against quality gates, security, approved design, and TDD. | `[Dev]` (review) |

> The `product_manager` and `designer` roles assist the human PM and Designer. The actual visual design is still done in the project's design tool; the `designer` agent structures the handoff.

## 2. Structure

```text
sdd/
├── README.md                 # SDD index
├── workflow.md               # This document
├── architecture.md           # Stack and architectural decisions (to complete)
├── conventions.md            # Code conventions (to complete)
├── quality-gates.md          # Definition of Ready / Done
├── testing.md                # Testing strategy and TDD
├── security.md               # Security and compliance
├── delivery.md               # Commits, PRs, merge, and closure
├── decisions/                # ADRs per feature or global
├── templates/                # Templates for features and issues
└── features/
    └── <feature-slug>/
        ├── README.md
        ├── product/
        │   ├── discovery/       ← product discovery iteration
        │   └── product-ready/   ← approved, unlocks [Design]
        ├── design/
        │   ├── spec-needed/
        │   ├── designing/
        │   └── design-ready/
        └── dev/
            ├── backlog/
            ├── spec-needed/
            ├── spec-ready/
            ├── implementing/
            ├── blocked/         ← issue paused by a blocker
            ├── review/
            ├── rejected/        ← issue rejected in review
            ├── testing/
            ├── done/
            └── cancelled/       ← issue discarded
```

### Naming Conventions

| Entity | Path | Title inside the file |
|---|---|---|
| Feature | `sdd/features/login-y-dashboard-layout/README.md` | `Login and Dashboard Layout` |
| Issue Product | `sdd/features/login-y-dashboard-layout/product/discovery/login.md` | `[Product] Login` |
| Issue Design | `sdd/features/login-y-dashboard-layout/design/spec-needed/login.md` | `[Design] Login` |
| Issue Dev | `sdd/features/login-y-dashboard-layout/dev/backlog/login.md` | `[Dev] Login` |

Slugs use kebab-case, lowercase, no accents.

---

## 3. States

### Issue `[Product]`

```text
discovery → product-ready
```

| Folder | Meaning |
|---|---|
| `product/discovery/` | Product behavior, users, and BDD scenarios are discovered and iterated. |
| `product/product-ready/` | Product spec approved. The `[Design]` Issue may advance. |

### Issue `[Design]`

```text
spec-needed → designing → design-ready
```

| Folder | Meaning |
|---|---|
| `design/spec-needed/` | Issue created, functional/UI spec missing. Blocked until `[Product]` is in `product-ready/`. |
| `design/designing/` | Visual design is iterated in the project's design tool. |
| `design/design-ready/` | Design and spec approved. The `[Dev]` Issue may advance. |

### Issue `[Dev]`

```text
backlog → spec-needed → spec-ready → implementing → review → testing → done
                    ↓         ↓           ↓              ↑
                blocked   blocked     blocked      rejected
                                    cancelled
```

| Folder | Meaning |
|---|---|
| `dev/backlog/` | Issue registered, blocked by `[Design]`. |
| `dev/spec-needed/` | Technical spec missing. |
| `dev/spec-ready/` | Technical spec complete. Awaiting human approval. |
| `dev/implementing/` | Developer working in the worktree. |
| `dev/blocked/` | Issue paused by external blocker or pending decision. |
| `dev/review/` | Code ready. Auditor verifying. |
| `dev/rejected/` | Auditor rejected. Requires rework before returning to `implementing/`. |
| `dev/testing/` | Merged. Final validation. |
| `dev/done/` | Feature completed and verified. |
| `dev/cancelled/` | Issue discarded. Kept for traceability. |

### Cross-Cutting States

- **blocked/**: can be used from `spec-needed/`, `spec-ready/`, or `implementing/`. Return to the previous state when unblocked.
- **rejected/**: only from `review/`. Must return to `implementing/` with clear action items.
- **cancelled/**: final state for discarded issues.

---

## 4. How a Feature Is Modeled

Each feature has its own **isolated worktree** from the start. Inside the worktree, specs are written, design is iterated, and code is implemented.

1. Create the feature worktree:
   ```bash
   ./scripts/sdd-worktree.sh create <feature-slug>
   ```
   This creates:
   - Branch `feature/<feature-slug>`.
   - Worktree at `<repo-principal>-<feature-slug>/`.
   - Empty structure at `sdd/features/<feature-slug>/`.
2. Open the coding agent inside the worktree.
3. Complete the project `README.md` and create issues as `.md` files inside state folders. Start with `[Product]`.
4. Move files physically between folders when they change state.
5. Merge the worktree to `main` when finished and remove it.

> The project must complete `sdd/architecture.md` and `sdd/conventions.md` so agents know which stack and style to use.

---

## 5. Workflow

1. **Idea**: the human describes the feature. The `orchestrator` creates the worktree with `./scripts/sdd-worktree.sh create <feature-slug>`.
2. **Product Discovery** (inside the worktree): the `product_manager` interviews the human and writes the product spec + BDD scenarios in `product/discovery/`. The `orchestrator` moves the file to `product/product-ready/`.
3. **Product review** (gate 0): human approves. The `[Product]` Issue remains in `product/product-ready/` and unlocks `[Design]`.
4. **Spec Design** (inside the worktree): the `designer` interviews the human and writes the functional + UI/UX spec in `design/spec-needed/`, referencing the BDD scenarios from `[Product]`. The `orchestrator` moves the file to `design/designing/`.
5. **Spec review** (gate 1): human approves. The `orchestrator` moves the file to `design/design-ready/`.
6. **Design iteration**: visual design is iterated in the project's design tool.
7. **Design review** (gate 2): human approves the design. The `[Design]` Issue remains in `design/design-ready/`.
8. **Spec Dev** (inside the worktree): the `tech_specifier` writes the technical spec + Test Plan in `dev/spec-needed/`, including BDD scenarios as acceptance tests. The `orchestrator` moves the file to `dev/spec-ready/`.
9. **Spec technical review** (gate 3): human approves. The `orchestrator` moves the file to `dev/implementing/`.
10. **Implementation** (inside the worktree): the `developer` runs TDD for each `R<n>` and each BDD scenario, writing code wherever the project defines. When finished and `init.sh` passes, the `orchestrator` moves the file to `dev/review/`.
11. **Review**: the `auditor` audits against `sdd/quality-gates.md` C1–C7. If approved: moves the file to `dev/testing/` and awaits human validation of the merge. If rejected: moves the file to `dev/rejected/` with action items.
12. **Testing** (gate 4): human validates the merge. The `orchestrator` merges the worktree to `main`, removes the worktree, and moves the file to `dev/done/`.

---

## 6. How to Move an Issue Between States

Use the helper:

```bash
./scripts/sdd-move.sh <project> <issue> <source-state> <destination-state>
```

Example:

```bash
./scripts/sdd-move.sh login-y-dashboard-layout login design/spec-needed design/designing
./scripts/sdd-move.sh login-y-dashboard-layout login dev/implementing dev/review
```

This runs `git mv` and generates the automatic state commit:

```text
chore(sdd): login [Design] spec-needed → designing
```

For manual moves:

```bash
git mv sdd/features/login-y-dashboard-layout/design/spec-needed/login.md \
       sdd/features/login-y-dashboard-layout/design/designing/login.md
```

The `orchestrator` commits the state change:

```text
chore(sdd): login [Design] spec-needed → designing
```

---

## 7. Worktree

Each feature lives in its own worktree from the start:

```bash
./scripts/sdd-worktree.sh create login-y-dashboard-layout
```

Creates:

- Branch: `feature/login-y-dashboard-layout`
- Worktree: `<repo-principal>-login-y-dashboard-layout/`
- Empty structure at `sdd/features/login-y-dashboard-layout/`

> The script does not install dependencies or copy environment files. Each project must prepare its own environment according to its stack.

To remove:

```bash
./scripts/sdd-worktree.sh remove login-y-dashboard-layout
```

---

## 8. Visual Design

The SDD assumes the project uses a **visual design tool** (Figma, Pencil, Sketch, etc.) as the reference for new screens and components.

- Every **new** component or screen must first exist in the project's design tool.
- The link to the artboard is included in the `UI/UX Design` section of the `[Design]` Issue.
- Existing base components in code are the **functional source of truth**; the design tool acts as visual reference and documentation.
- The developer does not modify existing base components without a specific issue.

> The project documents in `sdd/conventions.md` or `sdd/architecture.md` which design tool it uses and how it is synced with code.

---

## 9. Spec Versioning

- **Minor edits**: edit the file directly.
- **Structural changes**: add a `## Changelog` section at the end of the issue with date, what changed, and why.
- **Changes during implementation**: require human re-approval. If `[Design]` changes while `[Dev]` is in `implementing/` or beyond, the `orchestrator` must move `[Dev]` to `backlog/` or `spec-needed/`.

---

## 10. Human Gates

1. **Product / BDD** (`discovery/` → `product-ready/`).
2. **Functional/UI spec** (`spec-needed/` → `designing/`).
3. **UI design** (`designing/` → `design-ready/`).
4. **Technical spec** (`spec-needed/` → `spec-ready/` → `implementing/`).
5. **Review/merge** (`review/` → `testing/`).

---

## 11. Golden Rules

- Only one `[Dev]` Issue in `implementing/` or `review/` at a time.
- `[Dev]` does not advance until `[Design]` is in `design/design-ready/`.
- `[Design]` does not advance until `[Product]` is in `product/product-ready/`.
- `[Design]` is considered closed when it reaches `design/design-ready/`.
- `[Product]` is considered closed when it reaches `product/product-ready/`.
- Product before design, design before code.
- Tests before implementation (TDD).
- `sdd/` is the source of truth; there is no `feature_list.yaml` or `specs/` folder outside `sdd/`.
- Every important change is recorded in `sdd/features/` or in `sdd/decisions/`.
- Leave the repo clean on close: no temporary files or orphan branches.

---

## 12. Active Features Index

| Feature | Product | Design | Dev | Worktree |
|---|---|---|---|---|
| *(none)* | — | — | — | — |

> This index is updated manually.
