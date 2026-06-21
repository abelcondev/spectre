# [Design] Native SDD commands in Specter CLI

State: "design/design-ready"

## Command interface

### `spectre sdd init`

Initialize the SDD harness in the current working directory.

```
spectre sdd init [options]

Options:
  --force, -f    Overwrite existing harness files if they exist
  --dry-run      Print what would be created without writing files
```

Behavior:
- Detects if the current directory already contains an SDD harness (`AGENTS.md`, `CLAUDE.md`, `init.sh`, `sdd/`).
- If detected and `--force` is not passed, prints a warning and exits with code 1.
- Creates the minimum harness files needed for the SDD orchestrator to work:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `init.sh`
  - `sdd/README.md`
  - `sdd/workflow.md`
  - `sdd/architecture.md`
  - `sdd/conventions.md`
  - `sdd/quality-gates.md`
  - `sdd/testing.md`
  - `sdd/security.md`
  - `sdd/delivery.md`
  - `sdd/features/` (empty)
  - `sdd/decisions/` (empty)
- Does **not** create `scripts/sdd-worktree.sh` or `scripts/sdd-move.sh`.

Output:
- Success: `SDD harness initialized in <path>`
- Already exists: `SDD harness already present. Use --force to overwrite.`

### `spectre sdd worktree create <slug>`

Create a feature worktree and SDD project structure.

```
spectre sdd worktree create <slug>

Arguments:
  slug    Kebab-case feature identifier
```

Behavior:
- Validates the slug is kebab-case lowercase.
- Creates a Git worktree sibling to the current repo: `<repo>-<slug>/`.
- Creates branch `feature/<slug>`.
- Creates `sdd/features/<slug>/` with the standard state folders and `README.md`.
- Commits the empty project structure.

Output:
- Success: `Worktree ready for feature '<slug>'`
- Error: `Feature '<slug>' already exists` or `Invalid slug: ...`

### `spectre sdd move <slug> <issue> <source-state> <target-state>`

Move an SDD Issue between states.

```
spectre sdd move <slug> <issue> <source-state> <target-state>

Arguments:
  slug           Feature identifier
  issue          Issue filename without .md extension (e.g. "[Dev] my-feature")
  source-state   Current state path, e.g. dev/spec-needed
  target-state   Target state path, e.g. dev/implementing
```

Behavior:
- Validates that source and target states belong to the same Issue type (product, design, dev).
- Moves the Markdown file between state folders.
- Updates the `State:` line inside the file.
- Creates a commit with the move.

Output:
- Success: `Moved <issue> [Type]: <source-state> → <target-state>`
- Error: file not found, invalid transition, etc.

## Error handling

All commands print human-readable errors to stderr and exit with a non-zero code on failure.

## Help

Each command supports `--help` and integrates with the existing Commander help output.
