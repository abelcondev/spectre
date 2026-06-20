Manage SDD feature worktrees natively.

Commands:
- `create`: create a new Git branch `feature/<slug>` and a sibling worktree `<repo>-<slug>/` with the empty SDD project scaffold.
- `remove`: delete the worktree and its branch.
- `list`: show active feature worktrees for the current repository.
- `status`: show worktree path, branch, dirty state, and run `init.sh`.

Parameters:
- `command` (enum): one of `create`, `remove`, `list`, `status`.
- `featureSlug` (string, optional): kebab-case feature slug. Required for `create`, `remove`, and `status`.

Returns:
- Summary of the operation or error details.
