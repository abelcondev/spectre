# Testing — Strategy, TDD, and Executable Quality

The golden rule: **executable evidence, not claims**.

All work is demonstrated with executable evidence, not assertions.

---

## 1. Philosophy

- A feature is not finished until its tests pass.
- Tests document expected behavior better than any comment.
- Prefer tests that fail for the right reason (clear messages) over opaque tests.

---

## 2. Test Types

| Type | What It Validates | Where It Lives | Example |
|---|---|---|---|
| **Unit** | Pure logic, functions, utilities | `tests/unit/` or equivalent | `createReservation()` with valid and invalid data |
| **Integration** | Flows between modules, queries/mutations | `tests/integration/` or equivalent | Auth + create reservation + read reservation |
| **UI/Component** | Component behavior | `tests/component/` or equivalent | Form validates required fields |
| **E2E** | Complete user flow | `tests/e2e/` or equivalent | Login → create reservation → view dashboard |

The project defines in `sdd/architecture.md` which types are mandatory and which tools it uses.

---

## 3. TDD — Test Driven Development

Each `R<n>` from the `[Design]` Issue is implemented with the cycle:

```text
Red   → Write a failing test.
Green → Write the minimum code to make it pass.
Refactor → Improve the code while keeping the test green.
```

### Rules

1. **Never write production code without a test demanding it first.**
2. **A test must fail for a single reason.**
3. **Production code must be the minimum to pass.**
4. **Refactor only with all tests green.**

### Application in SDD

| SDD Phase | TDD Action |
|---|---|
| `dev/spec-needed/` → `spec-ready/` | The `tech_specifier` writes the **Test Plan** with acceptance tests for each `R<n>`. |
| `dev/implementing/` | The `developer` executes red-green-refactor per `R<n>`. |
| `dev/review/` | The `auditor` verifies that there is one test per `R<n>` and that commits reflect TDD. |
| `dev/testing/` → `done/` | `spectre sdd status` is green with reported coverage. |

### TDD Commits

```text
test(<scope>): R2 validate required customer — login-and-dashboard-layout/reservations
feat(<scope>): R2 add required customer validation — login-and-dashboard-layout/reservations
refactor(<scope>): simplify customer validation — login-and-dashboard-layout/reservations
```

---

## 4. Mandatory Test Plan

The `[Dev]` Issue must include a `## Test Plan` section derived directly from the `R<n>` of the `[Design]` Issue.

```markdown
## Test Plan

| Requirement | Acceptance test | Type | Priority |
|---|---|---|---|
| R1 | Create reservation with valid data returns active reservation | integration | mandatory |
| R2 | Create reservation without customer throws validation error | unit | mandatory |
| R3 | User without admin role does not see others' reservations | integration | mandatory |
```

Each test must be:
- **Atomic**: one behavior only.
- **Independent**: not depend on other tests.
- **Deterministic**: same result always.
- **Readable**: the name describes the behavior.

---

## 5. Test Structure

The project defines the structure. Typical example:

```text
tests/
├── setup.ts                 # Global config, mocks
├── fixtures/                # Reusable test data
├── unit/                    # Unit tests
└── integration/             # Integration tests
```

### Naming

- Unit tests: `<function-name>.test.<ext>`
- Integration tests: `<flow>.test.<ext>` or `<module>.integration.test.<ext>`
- Describe the behavior, not the implementation:
  - ✅ `create reservation without customer throws validation error`
  - ❌ `test createReservation 2`

---

## 6. Fixtures and Mocks

### Fixtures

Centralized, reusable test data:

```typescript
// tests/fixtures/users.ts
export const adminUser = { id: 'u-1', role: 'admin', email: 'admin@example.com' };
export const operatorUser = { id: 'u-2', role: 'operator', email: 'op@example.com' };
```

> Adapt to the project's language.

### Standard Mocks

The project defines in `tests/setup.*` the global mocks needed (navigation, environment, storage, etc.).

### Anti-Pattern

- ❌ Mocking the entire filesystem or network without justification.
- ❌ Mocking the library you are testing.
- ❌ Sharing mutable state between tests.

---

## 7. Coverage

### Minimum Thresholds

The project defines its thresholds in `sdd/architecture.md` or here. Example:

| Module Type | Minimum Coverage |
|---|---|
| Critical (payments, auth, sensitive data) | 100% |
| Main domain | 70% |
| Support/utilities | 50% |
| Pure UI | 30% |

### How to Measure

```bash
<test-runner> --coverage
```

> The project completes with its test runner.

---

## 8. R<n> → Test Traceability

Each `R<n>` must map to at least one concrete test. The auditor documents this in the `## Review` section of the `[Dev]` Issue:

```markdown
| Requirement | Test file | Line | Status |
|-----------|-----------|-------|--------|
| R1 | tests/integration/reservations/create.test.ts | 23 | ✅ |
| R2 | tests/unit/reservations/validate.test.ts | 41 | ✅ |
| R3 | tests/integration/reservations/rbac.test.ts | 18 | ✅ |
```

---

## 9. Testing Quality Gates

Before declaring `done`:

- [ ] The test runner passes without errors.
- [ ] Minimum project coverage is reached.
- [ ] Each `R<n>` has at least one test.
- [ ] Each acceptance test from the Test Plan is written.
- [ ] There are no "dumb" tests that only verify it does not crash.
- [ ] There are no unnecessary mocks of the filesystem or network.

---

## 10. Testing Anti-Patterns

- "It should work" without an executable test.
- A test that only verifies it does not crash.
- Excessive mocking of persistence or the filesystem.
- Writing all tests at the end.
- Tests that depend on execution order.
- Test names that do not explain the behavior.
