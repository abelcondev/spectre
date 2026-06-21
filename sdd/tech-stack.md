# Tech Stack — {name}

> **Technology inventory**. This document records the technologies chosen for the project, their versions, MCP servers, documentation URLs, and installation notes.
>
> It is created and maintained by the `sdd-tech-lead` on `main` during project setup. Feature developers read it but do not change it inside a worktree.

---

## Stack overview

| Layer | Technology | Version | Responsibility |
|---|---|---|---|
| Language | *(e.g. TypeScript)* | *(e.g. 5.7)* | ... |
| Framework | *(e.g. SvelteKit)* | *(e.g. 2.x)* | ... |
| Database | *(e.g. PostgreSQL)* | *(e.g. 16)* | ... |
| Auth | *(e.g. Lucia)* | *(e.g. 3.x)* | ... |
| UI / Styles | *(e.g. Tailwind CSS)* | *(e.g. 4.x)* | ... |
| Package manager | *(e.g. pnpm)* | *(e.g. 10.x)* | ... |
| Deployment | *(e.g. Vercel)* | — | ... |

## Languages & runtimes

- **Runtime**: *(e.g. Node.js 24)*
- **Primary language**: *(e.g. TypeScript 5)*
- **Other languages**: *(e.g. Python 3.12 for ML scripts)*

## Frontend

- **Framework / library**: ...
- **Build tool**: ...
- **State management**: ...
- **Routing**: ...
- **Forms / validation**: ...
- **MCP server**: *(name or N/A)*
- **Documentation URL**: ...
- **Version installed**: ...
- **Install command**: ...

## Backend

- **Framework / runtime**: ...
- **API style**: *(REST, GraphQL, RPC, etc.)*
- **MCP server**: *(name or N/A)*
- **Documentation URL**: ...
- **Version installed**: ...
- **Install command**: ...

## Database & storage

- **Database**: ...
- **ORM / query builder**: ...
- **Migration tool**: ...
- **Cache**: *(e.g. Redis, N/A)*
- **Object storage**: *(e.g. S3-compatible, N/A)*
- **MCP server**: *(name or N/A)*
- **Documentation URL**: ...
- **Version installed**: ...
- **Install command**: ...

## Authentication & authorization

- **Strategy**: *(OAuth, OTP, JWT, sessions, etc.)*
- **Provider / library**: ...
- **MCP server**: *(name or N/A)*
- **Documentation URL**: ...
- **Version installed**: ...
- **Install command**: ...

## External services / APIs

| Service | Purpose | MCP | Docs URL | Version |
|---|---|---|---|---|
| *(e.g. Stripe)* | Payments | *(name or N/A)* | ... | ... |
| *(e.g. SendGrid)* | Email | *(name or N/A)* | ... | ... |

## AI / LLM services

| Provider | Use case | Model | MCP | Docs URL | Version |
|---|---|---|---|---|---|
| *(e.g. OpenAI)* | Summaries | `gpt-4o` | *(name or N/A)* | ... | ... |

> If the PRD mentions AI capabilities but this section is empty, the Tech Lead must ask the human which provider to use before finishing setup.

## MCP servers

| MCP server | Technology | Configuration | Status |
|---|---|---|---|
| *(e.g. @modelcontextprotocol/server-postgres)* | PostgreSQL | `env: DATABASE_URL` | configured |

## DevOps / deployment

- **Hosting platform**: ...
- **CI/CD**: ...
- **Containerization**: *(Docker, N/A)*
- **Environment management**: ...
- **Monitoring / observability**: ...

## Documentation URLs

| Technology | Official docs |
|---|---|
| *(e.g. SvelteKit)* | https://svelte.dev/docs/kit |

## Versions & lockfile

- **Lockfile**: *(e.g. pnpm-lock.yaml, package-lock.json)*
- **Node / runtime version**: *(from .nvmrc or package.json engines)*
- **Last updated**: YYYY-MM-DD

## Project Setup Completion

This section is used by the Orchestrator to decide whether the project setup gate is complete. Do not remove it.

- [ ] **Stack overview** table has real technologies and versions (no `*(e.g. ...)*` placeholders).
- [ ] **Languages & runtimes** section has real values.
- [ ] **Frontend**, **Backend**, **Database & storage**, and **Authentication & authorization** sections are filled.
- [ ] **External services / APIs** and **AI / LLM services** sections are filled (or explicitly marked N/A).
- [ ] **MCP servers** section records configured MCPs (or explicitly states "none").
- [ ] **DevOps / deployment** section has real values.
- [ ] **Documentation URLs** table links to official docs for each technology.
- [ ] **Versions & lockfile** section has the lockfile name and runtime version.

## Notes

- *Any special setup instructions, environment variables, or known incompatibilities.*
