Verify that the SDD harness is installed and consistent in the current project.

This replaces the legacy `./init.sh` check. It validates:
- Required files (`AGENTS.md`, `CLAUDE.md`, `sdd/*.md`).
- Required directories (`sdd/features/`, `sdd/decisions/`).
- Basic state layout.

Returns:
- `[OK] SDD harness ready` if everything is in place.
- A list of `[FAIL]` / `[WARN]` lines otherwise.
