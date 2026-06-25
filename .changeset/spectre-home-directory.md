---
"@abelcondev/spectre": major
"@moonshot-ai/agent-core": major
"@moonshot-ai/acp-adapter": major
"@moonshot-ai/kimi-code-oauth": major
"@moonshot-ai/kimi-code-server": major
"@moonshot-ai/vis-server": major
"@moonshot-ai/kimi-code-sdk": patch
---

Change Spectre's default data directory from `~/.kimi-code` to `~/.spectre` so configuration, MCP servers, credentials, themes, skills, and project-local MCP files no longer overlap with Kimi Code CLI. `KIMI_CODE_HOME` remains available as an override. Users migrating from the shared directory should copy or move their existing `~/.kimi-code` contents to `~/.spectre`.
