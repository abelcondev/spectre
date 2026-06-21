# [Dev] Native SDD commands in Specter CLI

State: "dev/implementing"

## Summary

The Specter CLI already implements `spectre sdd init`, `spectre sdd worktree`, and `spectre sdd move` in `apps/kimi-code/src/cli/sub/sdd.ts`. However, the SDD asset bundle (`scripts/generate-sdd-assets.mjs`) still ships `scripts/sdd-worktree.sh` and `scripts/sdd-move.sh` when running `spectre sdd init`. Those scripts are project-feature utilities, not harness-setup files, so they must be removed from the bundle.

## Changes

1. `scripts/generate-sdd-assets.mjs`
   - Remove `sdd-worktree.sh` and `sdd-move.sh` from `SCRIPT_FILES`.

2. `packages/agent-core/src/tools/builtin/sdd/sdd-assets.ts`
   - Regenerate by running `node scripts/generate-sdd-assets.mjs`.

3. `apps/kimi-code/src/cli/sub/sdd.ts`
   - Ensure `spectre sdd init` still works after the asset change.
   - Add `--dry-run` support to `spectre sdd init` (optional but useful).

4. `README.md`
   - Document `spectre sdd init`, `spectre sdd worktree create`, and `spectre sdd move`.
   - Remove references to `./scripts/sdd-worktree.sh` and `./scripts/sdd-move.sh` as primary workflows.

5. Tests
   - Add/update tests in `apps/kimi-code/test/cli/sub/sdd.test.ts` (or create it) to verify:
     - `spectre sdd init` does not create `scripts/sdd-worktree.sh` or `scripts/sdd-move.sh`.
     - `spectre sdd status` passes on a freshly initialized harness.

## Test plan

- Unit tests for the asset bundle change.
- Manual smoke test: run `spectre sdd init` in a temp repo and confirm no `scripts/sdd-*.sh` files appear.
- Run `./init.sh` and relevant vitest tests.

## Impact analysis

- User-facing: `spectre sdd init` produces a cleaner harness without legacy scripts.
- Internal: the scripts remain in `scripts/` for now as reference/legacy; they are just no longer copied by `init`.
- No breaking change to the CLI command interface.
