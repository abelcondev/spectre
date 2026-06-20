# SDD — Troubleshooting

Guide to common problems when using the SDD framework and its scripts.

---

## Worktree

### `Worktree for '<slug>' already exists`

**Cause**: A worktree directory or a `feature/<slug>` branch already exists.

**Solution**:

```bash
# List existing worktrees
./scripts/sdd-worktree.sh list

# If the feature already finished or was abandoned, remove it
./scripts/sdd-worktree.sh remove <slug>

# Then create the new feature
./scripts/sdd-worktree.sh create <slug>
```

If the directory was left over from a previous error:

```bash
git worktree prune
rm -rf <repo-principal>-<slug>
git branch -D feature/<slug>
```

### `Could not remove with git worktree remove`

**Cause**: The worktree has open processes, locked files, or uncommitted changes.

**Solution**:

1. Close editors/terminals using the directory.
2. From the main repo:
   ```bash
   ./scripts/sdd-worktree.sh remove <slug>
   ```
   The script tries forced removal and cleans leftovers.
3. If it persists:
   ```bash
   git worktree remove --force <worktree-path>
   git worktree prune
   rm -rf <worktree-path>
   git branch -D feature/<slug>
   ```

---

## Invalid Slug

### `Invalid slug. Use kebab-case in lowercase`

**Cause**: The slug contains uppercase letters, accents, spaces, underscores, or special characters.

**Solution**: Use only lowercase letters, numbers, and hyphens. Valid examples:

- `login-and-dashboard-layout`
- `sdd-framework-improvements`
- `sales-report-v2`

Invalid examples:

- `LoginAndDashboard` → `login-and-dashboard-layout`
- `improvements_framework` → `improvements-framework`
- `sales report` → `sales-report`

---

## Moving Issues Between States

### `Invalid destination state: '...'`

**Cause**: The destination state is not in the valid list for [Design] or [Dev], or a type change was attempted.

**Solution**: Review `sdd/workflow.md` and use valid states:

- [Design]: `design/spec-needed`, `design/designing`, `design/design-ready`
- [Dev]: `dev/backlog`, `dev/spec-needed`, `dev/spec-ready`, `dev/implementing`, `dev/blocked`, `dev/review`, `dev/rejected`, `dev/testing`, `dev/done`, `dev/cancelled`

Correct example:

```bash
./scripts/sdd-move.sh login-and-dashboard-layout login design/spec-needed design/designing
./scripts/sdd-move.sh login-and-dashboard-layout login dev/implementing dev/review
```

### `sdd/features/<slug>/<state>/<issue>.md does not exist`

**Cause**: The Issue is not in the indicated source state.

**Solution**: Verify the current state with `git status` or by listing the folder:

```bash
ls sdd/features/<slug>/dev/*/
```

### `sdd/features/<slug>/<state>/<issue>.md already exists`

**Cause**: A file with the same name already exists in the destination state.

**Solution**: Check if the move was already done or if there is a duplicate issue. Do not overwrite without confirmation.

---

## `init.sh` Fails

### `[FAIL] <project> has no [Design] Issue` / `[Dev]`

**Cause**: The project does not meet the minimum requirement of having at least one Issue of each type.

**Solution**: Create the corresponding files in:

- `sdd/features/<slug>/design/spec-needed/<issue>.md`
- `sdd/features/<slug>/dev/backlog/<issue>.md`

### `[FAIL] There are N [Dev] Issues in implementing/ or review/`

**Cause**: There is more than one `[Dev]` Issue in `dev/implementing/` or `dev/review/` simultaneously.

**Solution**: Finish or pause one of the issues. Options:

- Move the inactive one to `dev/blocked/`.
- Finish the review of one before starting another.

### `[FAIL] <project>/design/<folder> is not a valid state`

**Cause**: A folder exists inside `design/` or `dev/` that is not in the list of valid states.

**Solution**: Rename or remove the folder. See valid states in `sdd/workflow.md`.

### `[FAIL] <project>/design/ contains .md files outside a state folder`

**Cause**: There are Markdown files directly in `design/` or `dev/`, instead of inside a state subfolder.

**Solution**: Move the file to the corresponding state folder.

---

## Installation

### `Destination directory is not a Git repository`

**Cause**: `install.sh` was run on a directory that is not a Git repo.

**Solution**: Initialize Git in the destination project before installing SDD:

```bash
cd /path/to/your-project
git init
git commit --allow-empty -m "init"
```

Then run `./install.sh` again.

### `AGENTS.md` or `CLAUDE.md` were accidentally overwritten`

**Cause**: `./install.sh` was run without `--update` and overwrite was confirmed, or `--update` was used without reviewing backups.

**Solution**: `--update` mode creates timestamped backups:

```bash
ls -la <destination>/AGENTS.md.backup-*
ls -la <destination>/CLAUDE.md.backup-*
```

Restore the desired backup:

```bash
cp <destination>/AGENTS.md.backup-<timestamp> <destination>/AGENTS.md
cp <destination>/CLAUDE.md.backup-<timestamp> <destination>/CLAUDE.md
```

---

## Commits and Git

### State changes do not appear in `git log`

**Cause**: The move was done with manual `mv` without a commit.

**Solution**: Always use `./scripts/sdd-move.sh`, which generates the automatic commit. If already moved manually:

```bash
git add sdd/features/<slug>/
git commit -m "chore(sdd): <issue> [Dev|Design] <source> → <destination>"
```

---

## References

- Workflow and states: `sdd/workflow.md`
- Scripts: `scripts/sdd-worktree.sh`, `scripts/sdd-move.sh`, `install.sh`
- Verification: `init.sh`
