Manage SDD feature worktrees natively.

A feature is a concrete piece of product functionality. The global product definition must be created first via `SddInit` (`sdd/product.md`).

Commands:
- `create`: create a new Git branch `feature/<slug>` and a sibling worktree `<repo>-<slug>/` with the empty SDD project scaffold. After creation the orchestrator must pause and tell the human to switch to the worktree to continue work on that feature.
- `remove`: delete the worktree and its branch.
- `list`: show active feature worktrees for the current repository.
- `status`: show worktree path, branch, dirty state, and run `spectre sdd status`.

Parameters:
- `command` (enum): one of `create`, `remove`, `list`, `status`.
- `featureSlug` (string, optional): kebab-case feature slug. Required for `create`, `remove`, and `status`.

Returns:
- Summary of the operation or error details.
