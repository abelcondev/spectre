---
"@abelcondev/spectre": minor
---

Add a `Knowledge` tool and service that index the project's OKF knowledge bundle (`sdd/`). Concept metadata (type, title, description, status, tags) is parsed from each file's YAML frontmatter and summarized into the system prompt at session start, so the agent always knows which decisions, tasks, and proposals exist. The `Knowledge` tool searches the bundle (optionally scoped to a concept type) so the agent can recall prior decisions and context instead of re-reading files or re-asking the user. Available to the main agent and the coder/explore/plan subagents.
