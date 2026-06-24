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
| `product_manager` | Optional subagent | Deep product research and formal `[Product]` spec. | `[Product]` |
| `tech_lead` | Optional subagent | Complex technical setup on `main`. | Project setup (technical) |
| `tech_specifier` | Optional subagent | Technical spec for complex `[Dev]`. | `[Dev]` (spec) |
| `developer` | Subagent | TDD implementation using Design → Code. | `[Dev]` (implementation) |
| `auditor` | Subagent | Tests the implementation and gives feedback. | `[Dev]` (review) |

The human is the creative director in Pencil. Spectre assists with operational Pencil tasks (file creation, exports, reading state, applying concrete human-described changes) but does not impose visual design decisions.

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

## 3. Product Discovery on `main`

Before any technical setup, Spectre guides the human through a focused product conversation directly. No `TodoList` of future phases is shown to the human; each message advances one step.

### 3.1 Phase 0 — Research

Spectre (or `sdd-product-manager` for complex cases):

1. Asks the human about the problem, users, and success criteria.
2. Reads existing code, docs, or runs short web research when useful.
3. Identifies constraints (security, compliance, business, timeline).
4. Summarizes findings in plain language.

### 3.2 Phase 1 — Proposal + Brand Direction

Spectre presents a concise proposal to the human:

- **Goal**: one-sentence outcome.
- **Scope**: in-scope and explicitly out-of-scope for the first milestone.
- **Risks**: main risks and mitigations.
- **Brand direction**: product name, tone of voice, color palette, typography, visual style, logo/icons, and key terminology.
- **Open questions**: decisions that still need the human.

The human must explicitly approve the proposal and the brand direction before moving on. This is **gate 0**.

### 3.3 Phase 2 — Brand document

After approval, Spectre writes `sdd/brand.md` from the `brand.md` template. This document is the source of truth for:

- `sdd/conventions.md` (CSS classes, token naming, theme).
- `sdd/design-system/design-system-spec.md` (design tokens).
- Any Pencil work the human does later.

## 4. Project Setup on `main`

Project setup happens in two phases on `main`. No feature worktree may be created until both are complete.

### 4.1 Phase A — Technical setup

The `tech_lead`:

1. Reads the approved `sdd/product.md` and PRD.
2. Interviews the human about the technical stack (framework, DB, auth, package manager, deployment, MCPs).
3. Resolves versions from the registry.
4. Writes `sdd/architecture.md`, `sdd/tech-stack.md`, and `sdd/conventions.md` (without design tokens).
5. Creates the project folder structure, including `sdd/design-system/`.
6. Creates an empty placeholder `sdd/design-system/design-system.lib.pen` file (no design content).
7. Gets human approval for docs and install commands.
8. Installs dependencies.
9. Configures GitHub and pushes to `main`.

The Tech Lead does **not** ask about colors, typography, spacing, radius, or components, and does **not** add design content to the `.lib.pen` placeholder. Visual design is the human's responsibility in Phase B.

### 4.2 Phase B — Design System + Brand System setup

After technical setup, the human builds the visual layer freely in Pencil using `sdd/brand.md` as the source of truth. Spectre assists with operational tasks.

Spectre:

1. Runs the Pencil readiness gate (`mcp__pencil__get_editor_state`).
   - If it fails, run `node scripts/detect-pencil-mcp.mjs --write` to auto-configure the Pencil MCP.
   - If auto-detection succeeds, ask the human to restart Spectre (`/new`) and repeat the gate.
2. Helps the human create or open `sdd/design-system/design-system.lib.pen` if needed.
3. Writes/updates `sdd/design-system/design-system-spec.md` mapping tokens and primitives based on what the human decides in Pencil.
4. Helps populate `sdd/design-system/design-system.lib.pen` with foundations and primitive components when the human asks.
5. Asks the human to mark the file as a Design Library in Pencil (Libraries panel → "Turn this file into a library").
6. Declares `main` ready for features.

### 4.3 Setup gate

`main` is ready for features only when:

1. `sdd/brand.md` is complete and approved.
2. `sdd/architecture.md`, `sdd/conventions.md`, and `sdd/tech-stack.md` are complete and approved.
3. Dependencies are installed and the lockfile is present.
4. `sdd/design-system/design-system-spec.md` exists.
5. `sdd/design-system/design-system.lib.pen` is populated and marked as a Design Library.
6. GitHub is configured.

## 5. States

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

## 6. Feature Workflow

1. **Create worktree** (on `main`): Spectre creates the worktree with `SddWorktree`.
2. **Product Discovery**: Spectre guides the human step by step through research and a concise proposal that includes brand direction. Launch `sdd-product-manager` only for deep research or when the formalization of the approved proposal needs heavy lifting.
3. **Proposal + Brand approval** (gate 0): human approves the proposal and brand direction.
4. **Brand document**: Spectre writes `sdd/brand.md` from the approved brand direction.
5. **Product spec**: Spectre (directly or via `sdd-product-manager`) writes the `[Product]` issue in `product/discovery/` and moves it to `product/product-ready/` after human approval.
6. **Functional spec**: Spectre writes the functional spec + Pencil plan in `design/spec-needed/` directly.
7. **Functional spec approval** (gate 1): human approves. Move to `design/designing/`.
8. **Hi-fi prototype**: the human designs the screens/flows freely in Pencil. Spectre assists with operational tasks and records handoff notes in the Issue.
9. **Visual design approval** (gate 2): human approves. Move to `design/design-ready/`.
10. **Technical spec** (optional): Spectre writes the spec directly or launches `sdd-tech-specifier` for complex features.
11. **Technical spec approval** (gate 3): human approves. Move to `dev/implementing/`.
12. **Implementation**: Spectre launches `sdd-developer` for TDD using Design → Code.
13. **Review**: Spectre launches `sdd-auditor` to test and give feedback.
14. **Merge validation** (gate 4): human approves. Merge to `main` and move to `dev/done/`.

## 7. Visual Design

- **Tool**: Pencil.dev, connected via MCP.
- **Creative owner**: the human. Spectre assists with operational Pencil tasks only.
- **Design System library**: `sdd/design-system/design-system.lib.pen`.
- **Feature file**: `sdd/features/<slug>/design/assets/<slug>.pen`.
- Feature files must import the Design System library via the Pencil Libraries panel.
- Every new screen or component must exist in Pencil before implementation begins.
- The default implementation workflow is **Design → Code**: the Developer uses Pencil AI or HTML export from the `.pen` file as a starting point.

## 8. Human Gates

1. Product proposal + brand direction approval.
2. Product spec approval.
3. Functional spec approval.
4. Hi-fi prototype / visual design approval.
5. Technical spec approval (when applicable).
6. Merge validation.

## 9. Golden Rules

- Only one `[Dev]` Issue in `implementing/` or `review/` at a time.
- `[Dev]` does not advance until `[Design]` is in `design/design-ready/`.
- `[Design]` does not advance until `[Product]` is in `product/product-ready/`.
- Tests before implementation (TDD).
- `sdd/` is the source of truth.
- Subagents do not launch other subagents.
- **The Orchestrator does not use `TodoList` to drive the human conversation.** Guide step by step; subagents may use `TodoList` for their own internal work.
- `spectre sdd status` must be green before declaring `done`.

## 10. Active Features Index

| Feature | Product | Design | Dev | Worktree |
|---|---|---|---|---|
| *(none)* | — | — | — | — |
