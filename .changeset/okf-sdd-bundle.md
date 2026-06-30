---
"@abelcondev/spectre": minor
---

Adopt the Open Knowledge Format (OKF) as the standard for the `sdd/` project knowledge bundle. Concepts are now markdown files with YAML frontmatter (`type`, `title`, `description`, `status`, `timestamp`) that cross-link into a graph: `proposal.md` (`type: Proposal`), `decisions/` (`type: Decision`), `tasks/` (`type: Task`). The dashboard moves from `memory.md` to an OKF `index.md`, and a new append-only `log.md` records the bundle's history. `/sdd-setup` scaffolds the bundle and `/sdd-status` checks it.
