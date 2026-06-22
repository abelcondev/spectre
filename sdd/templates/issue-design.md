# [Design] <Issue title>

Project: `sdd/features/<feature-slug>/`
State: `<current-folder>`

## Context

Brief description of the problem or opportunity.

## Functional Spec

### Requirements

#### R1: [short title]

WHEN ..., the system MUST ... (EARS notation).

#### R2: [short title]

...

### Acceptance Criteria

- [ ] Verifiable criterion 1.
- [ ] Verifiable criterion 2.

### User Flows

```text
Screen/Action 1 → Screen/Action 2 → Final result
```

- **Main flow**: step-by-step happy path.
- **Alternative flows**: errors, cancellations, empty states.
- **Edge cases**: limits, permissions, unusual conditions.

### BDD Reference

- Approved [Product] issue: `sdd/features/<feature-slug>/product/product-ready/<issue-product>.md`
- Relevant scenarios for the design:
  - **Scenario**: [name] — `Given ... When ... Then ...`
  - **Scenario**: [name] — `Given ... When ... Then ...`

> The UI/UX design must be able to execute the BDD scenarios approved in [Product]. If a scenario is not visually supportable, document the limitation and notify the orchestrator.

## UI/UX Design

### Layout

- Screen structure, grid, breakpoints, spacing.

### Colors

- Palette, states (default, hover, active, disabled, error, success).

### Typography

- Scales, weights, and styles.

### Components

- Existing components to reuse, new components to create, variants.
- Cross-reference with the **Design System reference** and **Pencil plan** below: every component must map to a Design System primitive and have a matching entry in Pencil.dev before the issue reaches `design-ready`.

### UI Flows

- Empty, loading, error, success, form states.

### Interactions

- Transitions, hover, focus, modals, drawers.

### Accessibility

- Contrast, keyboard navigation, ARIA.

### Design System reference

- **Design System file**: `sdd/design-system/design-system.pen` (or shared Pencil file page recorded in `sdd/conventions.md`). This file holds the project foundations and base components only; feature views/screens go in the feature Pencil file below.
- **Feature Pencil file**: `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen` — where frames, views, and feature-specific components are created from the Design System primitives.
- **UI primitives library**: *(e.g. shadcn-svelte, Bits UI, Tailwind UI)* — recorded in `sdd/conventions.md`
- **Primitives this feature reuses**: list the base components from the Design System that this feature uses (e.g. Button, Input, Card)
- **Primitives this feature extends or adds**: list any new primitive that must be added to the Design System before feature design

### Pencil plan (filled in `design/spec-needed/`)

- **Tool**: Pencil.dev (default; connected via MCP)
- **MCP status**: *(configured / pending)*
- **Pencil file path**: `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen` (default; update if the project uses a shared file)
- **Frames / views to create**: list the Pencil frames and views this feature needs
- **Components to create or reuse**: list reusable components to create in Pencil or reuse from the design system; every new component must map to a Design System primitive
- **Design tokens to use/add**: reference `sdd/conventions.md` → Design Tokens; note any new tokens needed
- **Pencil format guard**: confirm that every node will use a valid Pencil type (`frame`, `group`, `rectangle`, `ellipse`, `polygon`, `path`, `text`, `note`, `prompt`, `context`, `icon`, `script`, `ref`) and that design tokens are stored as Pencil `variables`, not invented types like `page`, `color-swatch`, `text-style`, `spacing-token`, `radius-token`, or `component`
- **MCP guard**: confirm that the Design System will be created/edited via the Pencil.dev MCP server, not by writing raw `.pen` JSON

### Pencil artifacts (filled in `design/designing/`)

After the functional spec is approved, create/update the Pencil file and record the actual artifacts:

- **Pencil file path**: `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen`
- **Design System file updated**: `sdd/design-system/design-system.pen` (or shared file page) — confirm whether primitives were added or changed
- **Pencil frames / views**: actual frame names and view identifiers created in Pencil.dev
- **Pencil components**: actual reusable components created or reused in Pencil.dev; map each to a Design System primitive
- **Design tokens used**: actual tokens from `sdd/conventions.md` and any new token added for this feature
- **Relevant screenshots / exports**: [links or exports]
- **Human iteration notes**: record any feedback or decisions from the human's direct iteration in Pencil.dev

## Handoff to Dev

- **Components to create or extend**: list with required variants.
- **Existing components to reuse**: references to design system or code.
- **Key contracts**: input/output formats, shared states, events.
- **UI decisions pending validation**: anything that must be confirmed during implementation.
- **Implementation notes**: technical constraints observed from the design.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Dependencies

- Blocks: `[Dev] <issue-dev>`

## Changelog

| Date | Author | Change | Reason |
|---|---|---|---|
| YYYY-MM-DD | Name | Brief description of the change | Why it was made |

> Record structural or scope changes during the issue lifecycle.

## Review

### Verdict: ✅ Approved / ❌ Rejected

### Findings
1. ...

### Action items (if rejected)
1. ...
