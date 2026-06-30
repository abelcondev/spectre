---
"@abelcondev/spectre": minor
---

Improve the Reference tool: index dependencies from the full upstream git source first (richest context — original source, tests, comments), then fall back to the installed `node_modules` copy (offline, version-exact) instead of an npm fetch, with `npm pack` only as a last resort; in a monorepo, ground against dependencies from every workspace so they are referenceable from any folder; inject the indexed-sources summary as a system reminder once background warm-up finishes (cold-start sessions no longer miss it); and steer the agent to prefer `Reference` over reading `node_modules`. Also re-grant the `Context7` tool to the default profile and fix stale references in the README and system prompt.
