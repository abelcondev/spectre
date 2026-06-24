Query the Context7 API for up-to-date library documentation and version information. Use this before proposing technologies, versions, or compatibility claims.

Operations:
- `search`: find a library by name and get its Context7 library id and available versions.
- `query`: ask a focused question against a specific library id and receive documentation excerpts.

Requires a Context7 API key configured in config.toml under `[services.context7]` or via the `CONTEXT7_API_KEY` environment variable.
