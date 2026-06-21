# [Product] Native SDD commands in Specter CLI

State: "product/product-ready"

## Problem

Specter ships with SDD as the default agent mode, but the SDD workflow still depends on shell scripts inside the repository (`scripts/sdd-worktree.sh`, `scripts/sdd-move.sh`) and manual file creation to bootstrap a repo without SDD. This creates friction:

- Users must know which scripts to run and from which directory.
- Repos that want to use Specter with SDD need to copy or recreate harness files manually.
- The boundary between "Specter the tool" and "SDD the project harness" is blurry.

## Solution

Provide native Specter CLI commands for the SDD harness and feature lifecycle:

1. `spectre sdd init` — initialize the SDD harness in the current repository (generate `AGENTS.md`, `CLAUDE.md`, `init.sh`, and `sdd/` guides and state folders). This is onboarding/setup, not a project feature.
2. `spectre feature create <slug>` — create a feature worktree and SDD project structure.
3. `spectre feature move <slug> <from-state> <to-state>` — move an issue between SDD states.

These commands replace `scripts/sdd-worktree.sh` and `scripts/sdd-move.sh` for normal usage. The scripts can remain as legacy/reference implementations or be removed later.

## Scope

- Add `spectre sdd init`.
- Add `spectre feature create`.
- Add `spectre feature move`.
- Update `AGENTS.md` / docs to document the new commands.

## Out of scope

- Rewriting the SDD state machine or folder layout.
- Adding new agent profiles.
- Changing the release workflow.

## Success criteria

- A user can run `spectre sdd init` in an empty repo and get a working SDD harness.
- A user can run `spectre feature create my-feature` instead of `./scripts/sdd-worktree.sh create my-feature`.
- A user can run `spectre feature move my-feature spec-ready implementing` instead of `./scripts/sdd-move.sh`.
