Move an SDD Issue file between state folders and commit the change.

This is the native equivalent of `./scripts/sdd-move.sh`.

Parameters:
- `featureSlug` (string): the feature project slug, e.g. `login-y-dashboard-layout`.
- `issueName` (string): the Issue file name without `.md`, e.g. `login`.
- `sourceState` (string): current state path, e.g. `design/spec-needed`.
- `targetState` (string): target state path, e.g. `design/designing`.

Validation:
- Source and target states must belong to the same Issue type (`product`, `design`, or `dev`).
- Source file must exist; target file must not exist.

The tool updates the `State:` line in the moved file and creates a Conventional Commit.
