# Repository Agent Guide — SDD

Reply in the same language as the user.

This project uses **SDD (Spec-Driven Development)**. The source of truth for features and their state is `sdd/features/`.

## Mandatory context for every session

1. Read `CLAUDE.md` (role enforcer).
2. Read `sdd/README.md`.
3. Read `sdd/workflow.md`.
4. Check the current state of issues in `sdd/features/`.

## Before declaring `done`

- `sdd/quality-gates.md` must be satisfied.
- The relevant `[Product]`, `[Design]`, and `[Dev]` Issues must be in the correct state folders.
- `init.sh` must be green (run on demand, not automatically).

## Project-specific conventions

- Stack and architecture: `sdd/architecture.md`
- Style and naming: `sdd/conventions.md`
- Testing strategy: `sdd/testing.md`
- Security: `sdd/security.md`
