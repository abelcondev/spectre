# SDD — Workflow, States, and Lifecycle

This document defines the SDD workflow, states, and rules.

For the general SDD index, see `sdd/README.md`.

---

## 1. Entities

- **Feature**: a business feature, represented by `sdd/features/<slug>/`.
- **Issue `[Product]`**: product discovery + BDD scenarios, `.md` file inside `sdd/features/<slug>/product/<state>/`. It is the first phase and unlocks `[Design]`.
- **Issue `[Design]`**: functional spec + reference to Pencil design, `.md` file inside `sdd/features/<slug>/design/<state>/`. Blocked by `[Product]`.
- **Issue `[Dev]`**: technical spec + implementation, `.md` file inside `sdd/features/<slug>/dev/<state>/`. Blocked by `[Design]`.

---

## 1.1 Roles

**Spectre (Orchestrator mode)** is the brain of the session. It acts directly by default and delegates to subagents only for long or specialized tasks.

| Role | Type | Responsible for | SDD Phase |
|---|---|---|---|
| `orchestrator` | Core mode of Spectre | Coordinates the flow, talks to the human, manages gates, moves issues. | Whole cycle |
| `product_manager` | Optional subagent | Complex product discovery and `[Product]` spec. | `[Product]` |
| `tech_lead` | Optional subagent | Complex technical setup on `main`. | Project setup (technical) |
| `designer` | Optional subagent | Large Design System build or complex feature design in Pencil. | Project setup (design) + `[Design]` |
| `tech_specifier` | Optional subagent | Technical spec for complex `[Dev]`. | `[Dev]` (spec) |
| `developer` | Subagent | TDD implementation using Design → Code. | `[Dev]` (implementation) |
| `auditor` | Subagent | Tests the implementation and gives feedback. | `[Dev]` (review) |

Spectre may do creative Pencil work directly with the human; the `designer` subagent is only used when the task is too large or the human prefers to delegate.

## 2. Structure

```text
sdd/
├── README.md                 # SDD index
├── workflow.md               # This document
├── architecture.md           # Stack and architectural decisions
├── conventions.md            # Code conventions and Design System rules
├── quality-gates.md          # Definition of Ready/Done
├── testing.md                # Testing strategy and TDD
├── security.md               # Security and compliance
├── delivery.md               # Commits, PRs, merge, and closure
├── decisions/                # ADRs
├── templates/                # Templates for features and issues
├── design-system/            # Project-level Design System
│   ├── design-system.lib.pen # Pencil Design Library (foundations + primitives)
│   ├── design-system-spec.md # Human-readable token/primitive map
│   └── README.md             # Summary
└── features/
    └── <feature-slug>/
        ├── README.md
        ├── product/
        │   ├── discovery/
        │   └── product-ready/
        ├── design/
        │   ├── spec-needed/
        │   ├── designing/
        │   ├── design-ready/
        │   └── assets/
        │       └── <slug>.pen
        └── dev/
            ├── backlog/
            ├── spec-needed/
            ├── spec-ready/
            ├── implementing/
            ├── blocked/
            ├── review/
            ├── rejected/
            ├── testing/
            ├── done/
            └── cancelled/
```

## 3. Project Setup on `main`

Project setup happens in two phases on `main`. No feature worktree may be created until both are complete.

### 3.1 Phase A — Technical setup

The `tech_lead`:

1. Reads `sdd/product.md` and the PRD.
2. Interviews the human about the technical stack (framework, DB, auth, package manager, deployment, MCPs).
3. Resolves versions from the registry.
4. Writes `sdd/architecture.md`, `sdd/tech-stack.md`, and `sdd/conventions.md` (without design tokens).
5. Gets human approval for docs and install commands.
6. Installs dependencies and creates the folder structure.
7. Configures GitHub and pushes to `main`.

The Tech Lead does **not** ask about colors, typography, spacing, radius, or components. Those are for the Designer.

### 3.2 Phase B — Design System setup

After the technical setup, Spectre sets up the visual layer, usually acting directly with the human via the Pencil MCP tools. It may launch the `designer` subagent only if the build is large or the human prefers to delegate.

Spectre:

1. Runs the Pencil readiness gate (`mcp__pencil__get_editor_state`).
   - If it fails, run `node scripts/detect-pencil-mcp.mjs --write` to auto-configure the Pencil MCP.
   - If auto-detection succeeds, ask the human to restart Spectre (`/new`) and repeat the gate.
2. Interviews the human about colors, borders, styles, typography, spacing, radius, and base components.
3. Writes `sdd/design-system/design-system-spec.md` mapping tokens and primitives.
4. Creates `sdd/design-system/design-system.lib.pen` with foundations and primitive components (directly via MCP or via the `designer` subagent).
5. Asks the human to mark the file as a Design Library in Pencil (Libraries panel → "Turn this file into a library").
6. Declares `main` ready for features.

### 3.3 Setup gate

`main` is ready for features only when:

1. `sdd/architecture.md`, `sdd/conventions.md`, and `sdd/tech-stack.md` are complete and approved.
2. Dependencies are installed and the lockfile is present.
3. `sdd/design-system/design-system-spec.md` exists.
4. `sdd/design-system/design-system.lib.pen` is populated and marked as a Design Library.
5. GitHub is configured.

## 4. States

### Issue `[Product]`

```text
discovery → product-ready
```

### Issue `[Design]`

```text
spec-needed → designing → design-ready
```

### Issue `[Dev]`

```text
backlog → spec-needed → spec-ready → implementing → review → testing → done
                    ↓         ↓           ↓              ↑
                blocked   blocked     blocked      rejected
                                    cancelled
```

## 5. Feature Workflow

1. **Create worktree** (on `main`): Spectre creates the worktree with `SddWorktree`.
2. **Product Discovery**: Spectre interviews the human and writes a concise `[Product]` issue directly. Launch `sdd-product-manager` only for complex discovery.
3. **Product approval** (gate 0): human approves. Move to `product/product-ready/`.
4. **Functional spec**: Spectre writes the functional spec + Pencil plan in `design/spec-needed/` directly. Launch `sdd-designer` only for complex specs.
5. **Functional spec approval** (gate 1): human approves. Move to `design/designing/`.
6. **Visual design**: Spectre runs the Pencil readiness gate and does the creative design work directly with the human via Pencil MCP. Launch `sdd-designer` only if the design task is too large.
7. **Visual design approval** (gate 2): human approves. Move to `design/design-ready/`.
8. **Technical spec** (optional): Spectre writes the spec directly or launches `sdd-tech-specifier` for complex features.
9. **Technical spec approval** (gate 3): human approves. Move to `dev/implementing/`.
10. **Implementation**: Spectre launches `sdd-developer` for TDD using Design → Code.
11. **Review**: Spectre launches `sdd-auditor` to test and give feedback.
12. **Merge validation** (gate 4): human approves. Merge to `main` and move to `dev/done/`.

## 6. Visual Design

- **Tool**: Pencil.dev, connected via MCP.
- **Design System library**: `sdd/design-system/design-system.lib.pen`.
- **Feature file**: `sdd/features/<slug>/design/assets/<slug>.pen`.
- Feature files must import the Design System library via the Pencil Libraries panel.
- Every new screen or component must exist in Pencil before implementation begins.
- The default implementation workflow is **Design → Code**: the Developer uses Pencil AI or HTML export from the `.pen` file as a starting point.

## 7. Human Gates

1. Product spec approval.
2. Functional spec approval.
3. Visual design approval.
4. Technical spec approval (when applicable).
5. Merge validation.

## 8. Golden Rules

- Only one `[Dev]` Issue in `implementing/` or `review/` at a time.
- `[Dev]` does not advance until `[Design]` is in `design/design-ready/`.
- `[Design]` does not advance until `[Product]` is in `product/product-ready/`.
- Tests before implementation (TDD).
- `sdd/` is the source of truth.
- Subagents do not launch other subagents.
- Subagents do not use `TodoList`.
- `spectre sdd status` must be green before declaring `done`.

## 9. Active Features Index

| Feature | Product | Design | Dev | Worktree |
|---|---|---|---|---|
| *(none)* | — | — | — | — |
