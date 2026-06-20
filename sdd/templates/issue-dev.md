# [Dev] <Issue title>

Project: `sdd/features/<feature-slug>/`
State: `<current-folder>`

## Context

Implementation of [<feature>], based on the approved design in [Issue Design].

## Technical Decisions

### D1: [title]

- **Chosen**: [option]
- **Discarded alternatives**: [B], [C]
- **Reason**: [why]
- **Impact**: [affected modules]

### D2: ...

## Impact Analysis

| Module | Action | Exposed contract |
|---|---|---|
| `<path-to-module-1>/` | create / modify | ... |
| `<path-to-module-2>/` | reuse | — |

## Technical Notes

- Tables, APIs, libraries, considerations.

## Implementation Plan

1. Step 1.
2. Step 2.
3. Step 3.

## Test Plan

### Tests derived from R<n>

| Requirement | Acceptance test | Type | Priority |
|---|---|---|---|
| R1 | ... | unit / integration | required |
| R2 | ... | unit / integration | required |

### BDD Test Plan

Gherkin scenarios approved in [Product] converted into automated or manual acceptance tests.

| Scenario | Given / When / Then | Test type | Status |
|---|---|---|---|
| [name] | `Given ... When ... Then ...` | integration / e2e / manual | pending |
| [name] | `Given ... When ... Then ...` | integration / e2e / manual | pending |

- Reference [Product] issue: `sdd/features/<feature-slug>/product/product-ready/<issue-product>.md`

## Security Considerations

- [ ] RBAC: roles that can execute each action.
- [ ] Inputs sanitized and validated.
- [ ] No PII exposed.
- [ ] Audit trail on critical mutations.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Dependencies

- blockedBy: [Design] `<issue-design>`

## UI Reference

- Approved design: `sdd/features/<feature-slug>/design/design-ready/`
- Artboards: `<feature-slug>-<screen>`
- Screenshots: [links]

## Changelog

| Date | Author | Change | Reason |
|---|---|---|---|
| YYYY-MM-DD | Name | Brief description of the change | Why it was made |

> Record structural, technical, or scope changes during the issue lifecycle.

## Review

### Verdict: ✅ Approved / ❌ Rejected

### Findings
1. ...

### Traceability R<n> → Test
| Requirement | Test file | Line | Status |
|-----------|-----------|-------|--------|
| R1 | ... | ... | ✅ |

### Action items (if rejected)
1. ...
