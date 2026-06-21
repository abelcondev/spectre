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

### UI Flows

- Empty, loading, error, success, form states.

### Interactions

- Transitions, hover, focus, modals, drawers.

### Accessibility

- Contrast, keyboard navigation, ARIA.

### Design assets

- **Tool**: Pencil.dev (default; connected via MCP)
- **MCP status**: *(configured / pending)*
- **Pencil frames / views**: list the frame names and view identifiers created in Pencil.dev
- **Pencil components**: list reusable components created or reused in Pencil.dev
- **Design tokens used**: reference `sdd/conventions.md` → Design Tokens; note any new tokens added for this feature
- **Relevant screenshots / exports**: [links or exports]

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
