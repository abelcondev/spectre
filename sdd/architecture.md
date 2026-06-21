# Architecture — What "Good Work" Means

> **Template**. This document must be completed by every project that adopts SDD. It defines the stack, layers, and architectural quality standards.
>
> If you are adopting SDD for the first time, read the **Example** first and then the [How to Complete This Document](#how-to-complete-this-document) section.

---

## Stack and Layers

Complete with the project's decisions:

- **Framework**: *(e.g. SvelteKit, Next.js, Django, Rails, etc.)*
- **Language**: *(e.g. TypeScript, Python, Ruby, Go, etc.)*
- **Database**: *(e.g. PostgreSQL, SQLite, InstantDB, etc.)*
- **Authentication**: *(e.g. OAuth, OTP, JWT, sessions, etc.)*
- **UI Components / Styles**: *(e.g. Tailwind, Material UI, CSS modules, etc.)*
- **Package Manager**: *(e.g. bun, npm, pnpm, poetry, etc.)*
- **Visual Design Tool**: *(e.g. Figma, Pencil, Sketch, etc.)*

> The detailed technology inventory — versions, MCP servers, documentation URLs, and install commands — lives in `sdd/tech-stack.md`. The Tech Lead creates and maintains that document on `main` during project setup.

### Example

> Project: **Acme CRM** — Multi-tenant SaaS for customer and sales management.

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | SvelteKit 5 + TypeScript 5 | Page rendering, user interaction, API calls |
| Styles | Tailwind CSS 4 + CSS variables | Responsive design, color/typography tokens |
| Backend/API | SvelteKit endpoints (`+server.ts`) + domain services | Business logic, validation, authorization |
| Database | PostgreSQL 16 + Prisma ORM | Relational persistence, controlled migrations |
| Auth | Lucia (sessions) + OAuth2 Google/SSO | Identity, sessions, basic RBAC |
| Queues/async | Inngest | Reported jobs, notifications, integrations |
| Storage | S3-compatible | Customer attachments, CSV exports |
| Design | Figma | Prototypes, artboards, visual components |

---

## Project Setup

The `sdd-tech-lead` agent sets up the project on `main` before any feature worktree is created. During setup the Tech Lead:

1. Reads `sdd/product.md`, including the PRD section, to understand product-level requirements.
2. Interviews the human about the technology stack.
3. For each technology, checks whether an MCP server exists; if not, asks for the official documentation URL and the version to install.
4. Reconciles the selected stack against the PRD and asks about omitted technologies (for example, an AI requirement in the PRD without a matching AI provider).
5. Updates this document (`sdd/architecture.md`) and creates/maintains `sdd/tech-stack.md`.
6. Installs dependencies and configures the repository.
7. Configures GitHub (creates the repo if needed) and pushes the setup commits to `main`.

All setup work happens on `main`. Feature development happens in isolated worktrees.

---

## Data Design

This section defines the guidelines for modeling, persisting, and evolving project data. It must be completed with the conventions specific to the chosen database stack.

- **Entity names and singularity**: use singular names for tables/collections (e.g. `user`, `invoice`) and descriptive names for join tables.
- **Primary keys**: prefer surrogate keys (UUID, ULID, autoincrement depending on stack) unless there is an explicit natural key requirement.
- **Foreign keys and relationships**: name them consistently (`<table>_id`), define `ON DELETE`/`ON UPDATE` actions explicitly and with justification.
- **Indexes**: create indexes only on frequently queried columns, filters, and joins; document when an index is composite or partial.
- **Audit fields**: include `created_at` and `updated_at` on business entities; add `created_by`/`updated_by` if the domain requires it.
- **Logical deletion**: prefer soft deletes (`deleted_at` or `status`) over hard deletes on business entities, unless explicitly decided otherwise.
- **Sensitive data**: mark PII/PHI fields, avoid storing them in plain text when applicable, and respect what is defined in `sdd/security.md`.
- **Migrations**: version every schema change; never modify already-applied migrations in shared environments.
- **Integrity validations**: use engine constraints (unique, not null, check, foreign keys) before relying solely on application validations.
- **Schema evolution**: breaking changes require an ADR in `sdd/decisions/`.

### Example: PostgreSQL Conventions

| Aspect | Convention |
|---|---|
| Tables | `snake_case`, singular (`user`, `organization`) |
| Columns | `snake_case`, explicit names (`email_verified_at`) |
| Foreign keys | `<table>_id` (`user_id`, `organization_id`) |
| Indexes | `idx_<table>_<columns>` |
| Unique constraints | `uq_<table>_<columns>` |
| Migrations | Timestamp + description (`20250619120000_create_users_table`) |

---

## Code Organization

Describe the project's folder structure. Example:

```text
src/
├── lib/              # Shared code
├── modules/          # Domain modules
├── routes/           # Routes or endpoints
└── app/              # Configuration and entry points
```

### Example

```text
src/
├── app.html                      # Base HTML template
├── app.d.ts                      # Global app types
├── routes/                       # SvelteKit routes
│   ├── (app)/                    # Authenticated layout
│   │   ├── dashboard/
│   │   ├── clients/
│   │   └── +layout.server.ts     # Session and permissions loading
│   └── (auth)/                   # Public layout
│       ├── login/
│       └── register/
├── lib/
│   ├── server/                   # Backend only
│   │   ├── auth/                 # Sessions, hashing, RBAC
│   │   ├── db/                   # Prisma client, schemas
│   │   ├── modules/              # Domain modules
│   │   │   ├── clients/
│   │   │   │   ├── client.service.ts
│   │   │   │   ├── client.repository.ts
│   │   │   │   ├── client.types.ts
│   │   │   │   └── client.policy.ts
│   │   │   └── opportunities/
│   │   └── jobs/                 # Async jobs (Inngest)
│   └── shared/                   # Code used by both frontend and backend
│       ├── schemas/              # Shared Zod schemas
│       ├── errors/               # Named domain errors
│       └── utils/                # Pure helpers
├── styles/                       # Variables, reset, extra utilities
└── tests/                        # Unit and integration tests
    ├── unit/
    └── integration/
```

---

## Project Golden Rules

Define the project's non-negotiable rules. Examples:

1. Explicit typing in public APIs.
2. No physical deletions on business entities; use terminal states.
3. RBAC on every sensitive route and function.
4. Audit trail on critical mutations.
5. All visible UI in the project's agreed language.

### Example

1. **All public APIs use Zod** to validate inputs before touching business logic.
2. **No hard deletes** on business entities (`Client`, `Opportunity`, `Invoice`). Terminal states are used (`ARCHIVED`, `CANCELLED`).
3. **RBAC on every route and function**: `requirePermission(user, 'clients:write')` before mutating.
4. **Audit trail** on every critical mutation: who, what, when, previous and new values.
5. **UI language**: neutral Spanish (configured in `sdd/conventions.md`).
6. **Sensitive data (PII) is never logged** nor exposed in error responses.
7. **Every new feature lives in its own worktree** from the start, following `sdd/workflow.md`.

---

## Typical Data Flow

Describe the system's typical data flow.

```text
User → Route/Controller → Domain Module → Persistence
                  ↓
            Audit trail (if critical)
```

### Example: Create a Client

```text
User (form) ──POST /api/clients──► +server.ts
                                              │
                                              ▼
                                       Zod schema validates input
                                              │
                                              ▼
                                       client.service.create()
                                              │
                                              ├──► client.policy.assertCanCreate(user)
                                              │
                                              ├──► client.repository.insert(data)
                                              │
                                              └──► audit.log('client.created', before, after)
                                              │
                                              ▼
                                       JSON response { id, ... }
```

Read flow:

```text
User ──GET /clients/[id]──► +page.server.ts
                                  │
                                  ▼
                           client.service.getById(id)
                                  │
                                  ├──► client.policy.assertCanRead(user, client)
                                  │
                                  └──► client.repository.findById(id)
                                  │
                                  ▼
                           Rendered in SvelteKit
```

---

## Current Architectural Decisions

`sdd/decisions/` starts empty in every new SDD installation. Use the template at `sdd/templates/adr-template.md` to create an ADR whenever a decision affects architecture, data design, or cross-feature conventions.

This document only summarizes active decisions. Each row should link to a real ADR file once it is created.

### Example

| Decision | Status | ADR |
|---|---|---|
| Use worktrees per feature | Active | `sdd/decisions/0001-worktrees-per-feature.md` *(create from template)* |
| Markdown as source of truth | Active | `sdd/decisions/0002-markdown-source-of-truth.md` *(create from template)* |
| SvelteKit as full-stack framework | Active | `sdd/decisions/0003-sveltekit-fullstack.md` *(create if applicable)* |
| PostgreSQL + Prisma as persistence | Active | `sdd/decisions/0004-postgres-prisma.md` *(create if applicable)* |

---

## Project Setup Completion

This section is used by the Orchestrator to decide whether the project setup gate is complete. Do not remove it.

- [ ] **Stack and Layers** section has real technologies (no `*(e.g. ...)*` placeholders).
- [ ] **Code Organization** section describes the actual folder structure.
- [ ] At least 5 **Project Golden Rules** are defined.
- [ ] **Typical Data Flow** section has a real read and write example.
- [ ] **Current Architectural Decisions** table links to real ADR files in `sdd/decisions/` (or states "none yet" explicitly).

## How to Complete This Document

1. Replace the "*(e.g. ...)*" fields in the **Stack and Layers** section with the project's actual technologies.
2. Adapt the **Code Organization** folder structure to your stack.
3. Write at least 5 non-negotiable **golden rules** for your team.
4. Draw the **data flow** for a representative operation (read and write).
5. Update the **Current Architectural Decisions** table with real ADRs in `sdd/decisions/` (use `sdd/templates/adr-template.md`).
6. Remove sections marked as **Example** when the document is mature, or keep them as reference while the team adopts SDD.
7. Check all boxes in the **Project Setup Completion** section above.
