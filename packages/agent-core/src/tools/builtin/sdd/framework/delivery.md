# Delivery — Commits, PRs, Merge, and Closure

This document defines how work is delivered: commits, pull requests, merge, and clean closure.

---

## 1. Commits

### Format: Conventional Commits

```text
<type>(<scope>): <short description> — <project>/<issue>
```

Examples:

```text
feat(reservations): add customer validation — login-and-dashboard-layout/reservations
test(reservations): R2 validate required customer — login-and-dashboard-layout/reservations
fix(auth): fix post-login redirect — login-and-dashboard-layout/login
refactor(shell): simplify admin layout — login-and-dashboard-layout/dashboard
chore(sdd): login [Design] spec-needed → designing
```

### Common Types

| Type | Use |
|---|---|
| `feat` | New functionality |
| `fix` | Bug fix |
| `test` | Tests (TDD: red commit) |
| `refactor` | Internal change without behavior change |
| `chore` | Maintenance tasks, SDD state changes |
| `docs` | Documentation |
| `style` | Formatting, no logical change |

### SDD State Commits

When the `orchestrator` moves an issue between folders:

```text
chore(sdd): login [Design] spec-needed → designing
chore(sdd): reservations [Dev] implementing → review
```

### TDD Commits

In TDD, each `R<n>` generates at least two commits:

```text
test(<scope>): R<n> <expected behavior> — <project>/<issue>
feat(<scope>): R<n> <minimum implementation> — <project>/<issue>
```

Optionally a third:

```text
refactor(<scope>): R<n> <internal improvement> — <project>/<issue>
```

### Rules

- Small, atomic commits.
- Each commit must pass the project's checks (lint, typecheck, fast tests as defined in `sdd/architecture.md`).
- Always reference the project/issue.
- Do not include `Co-Authored-By` for AI assistants. The user is the sole author.

---

## 2. Pull Requests

### Creation

When the `developer` finishes and the `[Dev]` Issue is in `dev/review/`, the `orchestrator` can create the PR:

```bash
cd <repo-principal>-<project>
gh pr create \
  --title "<project>/<issue>: change title" \
  --body "Closes <project>/<issue>" \
  --base main
```

> The project may use another forge/host; adapt the command.

### Suggested Body

```markdown
## Summary
Brief description of the change.

## Traceability
| Requirement | Test file | Status |
|-----------|-----------|--------|
| R1 | tests/integration/... | ✅ |
| R2 | tests/unit/... | ✅ |

## Checklist
- [ ] `init.sh` passes in the worktree.
- [ ] Minimum coverage reached.
- [ ] No dependencies added without justification.

Closes <project>/<issue>
```

### Product-Change Pull Requests

Product-level changes (scope, UI, functionality, or PRD updates) are delivered through a branch + PR, **not** through a feature worktree.

1. Create the branch from `main`:
   ```bash
   git checkout -b product/<change-slug>
   ```
2. Update `sdd/product.md` (including the PRD section) and add a changelog entry.
3. Write or update the ADR in `sdd/decisions/<change-slug>.md` explaining the decision and its impact.
4. Commit with `docs(product): ...` and `docs(decisions): ...`.
5. Open the PR:
   ```bash
   gh pr create --title "product: <change-title>" --body "Updates sdd/product.md and records the decision in sdd/decisions/<change-slug>.md" --base main
   ```
6. After human approval and merge, the `product_manager` notifies designers and developers to pull `main`.
7. If the change affects an active feature, the team treats it as input for that feature's next Issue iteration.

---

## 3. Merge

Merge is **NOT automatic**. It requires:

1. ✅ verdict from the `auditor`.
2. Explicit human approval (human gate 4).
3. Green `init.sh` in the worktree.
4. Dependency audit without critical vulnerabilities (for critical features).

Only then does the `orchestrator` merge the PR and move the Issue file to `dev/done/`.

---

## 4. `[Dev]` Issue Closure

When a `[Dev]` Issue reaches `dev/done/`, the `orchestrator`:

1. Removes the worktree:
   ```bash
   ./scripts/sdd-worktree.sh remove <project>
   ```
2. Updates `sdd/README.md` with the current project state.
3. Adds a `## Closure` section at the end of the `[Dev]` Issue file:
   ```markdown
   ## Closure

   - **Result**: feature merged to `main`.
   - **Relevant decisions**: summary of `D<n>` that impacted architecture.
   - **Next steps**: derived issues or technical debt.
   ```
4. Documents any relevant decision or pattern in `sdd/decisions/`.

---

## 5. Session Closure

Before declaring a session closed:

1. Run `init.sh`. It must print the configured success message.
2. If a `[Dev]` Issue was finished, ensure its file is in `dev/done/`.
3. If a `[Design]` Issue was closed, ensure its file is in `design/design-ready/`.
4. Update `sdd/README.md` with the current project state.
5. Document relevant decisions, conventions, or discoveries.
6. Ensure there are no suspicious untracked files.

---

## 6. Delivery Anti-Patterns

- Merging without auditor and human approval.
- Marking `done` without green `init.sh`.
- Giant commits mixing multiple features.
- PRs without description or traceability.
- Leaving orphan worktrees after merging.
