# Quality Gates — Definition of Ready / Done

The golden rule: **executable evidence, not claims**.

All work is demonstrated with executable evidence, not assertions.

---

## 1. Definition of Ready (DoR)

A `[Dev]` Issue is ready to move from `dev/spec-ready/` to `dev/implementing/` when:

- [ ] The corresponding `[Design]` Issue is in `design/design-ready/`.
- [ ] The technical spec is complete (see `templates/issue-dev.md`).
- [ ] The technical decisions `D<n>` include discarded alternatives.
- [ ] The **Test Plan** covers each `R<n>` from the `[Design]` Issue.
- [ ] The **Impact Analysis** identifies affected modules.
- [ ] The security checklist is completed if applicable.
- [ ] There are no unresolved dependencies.

---

## 2. Definition of Done (DoD)

A `[Dev]` Issue is ready to move from `dev/review/` to `dev/testing/` when:

- [ ] All `R<n>` are implemented and tested.
- [ ] `spectre sdd status` is green in the worktree.
- [ ] Minimum coverage is reached per `sdd/testing.md`.
- [ ] `R<n>` → test traceability is documented.
- [ ] There are no debug logs or dead code.
- [ ] The implemented UI matches the approved design and `[Design]` Issue.
- [ ] The `auditor` issued a ✅ verdict.
- [ ] The human approved the merge.

---

## 3. Mandatory Quality Gates

Before declaring `done`, `spectre sdd status` must be green. The project defines in `sdd/architecture.md` / `sdd/conventions.md` which commands to run. Typical example:

```bash
<test-runner> --coverage    # tests with coverage
<type-check>                # typecheck
<linter>                    # lint
<audit>                     # dependency vulnerabilities
<build>                     # build
```

> The project completes `sdd/architecture.md` and `sdd/conventions.md` with the concrete tools.

---

## 4. Verification Levels

### 4.1 Unit Tests

- Happy path of every public function.
- At least one error case per public function.
- No unnecessary mocks of the filesystem or network.

### 4.2 Integration Tests

- Flows between modules.
- Interaction with persistence and auth.
- RBAC validation.

### 4.3 Build and Quality Gates

Verified by `spectre sdd status` (see section 3).

### 4.4 Requirements Traceability

Each `R<n>` from the `[Design]` Issue must map to at least one concrete test.

Example documentation in the `## Review` section:

```markdown
| Requirement | Test file | Line | Status |
|-----------|-----------|-------|--------|
| R1 | tests/unit/clients/create.test.ts | 23 | ✅ |
| R2 | — | — | ❌ MISSING |
```

---

## 5. Closure Checklist (C1–C7)

The `auditor` verifies each item before approving moving an Issue to `done`.

### C1 — Complete Harness

- [ ] `AGENTS.md` exists.
- [ ] `CLAUDE.md` exists and forces the orchestrator role.
- [ ] `sdd/README.md` exists.
- [ ] `sdd/workflow.md` exists.
- [ ] `sdd/architecture.md` exists and is completed.
- [ ] `sdd/conventions.md` exists and is completed.
- [ ] `sdd/quality-gates.md` exists.
- [ ] `sdd/testing.md` exists.
- [ ] `sdd/security.md` exists.
- [ ] `sdd/delivery.md` exists.
- [ ] `.claude/agents/` has `orchestrator.md`, `product_manager.md`, `designer.md`, `tech_specifier.md`, `developer.md`, `auditor.md`.
- [ ] `spectre sdd status` reports success.
- [ ] `sdd/features/` exists and has at least one project.

### C2 — State Coherence

- [ ] At most one `[Dev]` Issue in `implementing/` or `review/`.
- [ ] The Project contains at least one `[Design]` Issue and one `[Dev]` Issue.
- [ ] The `[Dev]` Issue is in `dev/backlog/` until `[Design]` is in `design/design-ready/`.
- [ ] All states in `sdd/features/` are valid folders per `sdd/workflow.md`.
- [ ] If a `[Design]` Issue is in `design/designing/` or beyond, its description contains a complete functional + UI/UX spec.
- [ ] If a `[Design]` Issue is in `design/design-ready/`, its description contains the complete `UI/UX Design` section and design assets.
- [ ] If a `[Dev]` Issue is in `dev/spec-ready/` or beyond, its description contains a complete technical spec.
- [ ] If a `[Dev]` Issue is in `dev/implementing/` or beyond, the worktree exists at `<repo-principal>-<project>/`.

### C3 — Architectural Compliance

- [ ] New code respects the stack and conventions defined in `sdd/architecture.md` and `sdd/conventions.md`.
- [ ] There is no typing/style that contradicts project conventions.
- [ ] There are no duplicate libraries in functionality.
- [ ] There are no debug logs or dead code.
- [ ] All UI text is in the agreed language.
- [ ] RBAC respected in new routes and components.
- [ ] No physical deletions on business entities: terminal states are used.
- [ ] Audit trail present on critical mutations.
- [ ] The implemented UI matches the approved design and the `[Design]` Issue.

### C4 — Real Verification

- [ ] The project's test runner passes without errors.
- [ ] The project's type checker passes without errors.
- [ ] The project's linter passes without warnings.
- [ ] The project's build passes without errors.
- [ ] The dependency audit reports no critical vulnerabilities.
- [ ] Each `R<n>` requirement has at least one test validating it.

> The project defines in `sdd/architecture.md` / `sdd/conventions.md` which concrete commands to use.

### C5 — Clean Session Closure

- [ ] `spectre sdd status` reports success.
- [ ] There are no suspicious untracked files.
- [ ] If a `[Dev]` Issue was closed, its file is in `dev/done/`.
- [ ] If a `[Design]` Issue was closed, its file is in `design/design-ready/`.
- [ ] If a `[Dev]` Issue was closed, the worktree was removed.
- [ ] `sdd/README.md` was updated with the current project state.

### C6 — SDD Compliance

- [ ] The `[Design]` Issue passed through `design/spec-needed/` → `design/designing/` → `design/design-ready/`.
- [ ] The `[Dev]` Issue passed through `dev/spec-needed/` → `dev/spec-ready/` → `dev/implementing/` before touching production code.
- [ ] The human gate between `spec-needed/` and `designing/` was respected.
- [ ] The human gate between `designing/` and `design-ready/` was respected.
- [ ] The human gate between `spec-ready/` and `implementing/` was respected.
- [ ] Each Issue description uses the template from `sdd/workflow.md`.

### C7 — Security

- [ ] RBAC validated in tests.
- [ ] Inputs sanitized and validated.
- [ ] No PII logged.
- [ ] Audit trail present on critical mutations.
- [ ] Dependency audit without critical vulnerabilities.
- [ ] No hard deletes on business entities.
- [ ] Secrets outside the codebase.

If **any** checkbox from C1–C7 is empty, the verdict is **❌ Rejected** with clear action items.

---

## 6. General Anti-Patterns

- "It should work" without an executable test.
- A test that only verifies it does not crash.
- Excessive mocking of the filesystem or network.
- Declaring `done` without a green `spectre sdd status`.
- Merging without auditor and human approval.
- Moving a `[Dev]` Issue to `implementing/` without `[Design]` being in `design/design-ready/`.
- Modifying existing base components without prior approval.
