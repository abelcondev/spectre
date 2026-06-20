Verify that the SDD harness is installed and consistent in the current project.

This is the native equivalent of `./init.sh`. It checks for:
- Required files (`AGENTS.md`, `CLAUDE.md`, `init.sh`, `sdd/*.md`).
- Required directories (`sdd/features/`, `sdd/decisions/`).
- Whether `init.sh` is executable.

Returns:
- `[OK] SDD harness ready` if everything is in place.
- A list of `[FAIL]` / `[WARN]` lines otherwise.
