Install the SDD (Spec-Driven Development) framework into the current Git repository.

This writes the standard SDD files (`sdd/`, `AGENTS.md`, `CLAUDE.md`) from the bundled Spectre assets and commits them on `main` with the message `chore(sdd): install framework`.

If the current directory is not a Git repository, SddInit initializes one, creates the `main` branch, and commits the framework files. It refuses to install into a parent repository that is not the current directory (for example, the user's home directory).

On first install, SddInit requires a global product definition (`sdd/product.md`). If it does not exist yet, call SddInit with `product_answers` to create it, or run it without answers to receive the discovery questions.

Parameters:
- `force` (boolean, optional): overwrite existing SDD files if they already exist.
- `product_answers` (object, optional): answers that populate `sdd/product.md` and seed `sdd/architecture.md` and `sdd/conventions.md`. Required on first install when `sdd/product.md` is missing.

Returns:
- Success: summary of written files and the commit.
- Error: if the directory is inside an unintended parent repository, SDD is already installed (unless `force=true`), or product answers are needed.
