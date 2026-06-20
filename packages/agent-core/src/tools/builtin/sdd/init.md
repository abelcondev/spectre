Install the SDD (Spec-Driven Development) framework into the current Git repository.

This writes the standard SDD files (`sdd/`, `scripts/`, `AGENTS.md`, `CLAUDE.md`, `init.sh`) from the bundled Specter assets. It also stages the new files with `git add` so the human can review before committing.

Requirements:
- The working directory must be inside a Git repository.

Parameters:
- `force` (boolean, optional): overwrite existing SDD files if they already exist.

Returns:
- Success: summary of written files and a reminder to review `git diff --cached`.
- Error: if the directory is not a Git repo or SDD is already installed (unless `force=true`).
