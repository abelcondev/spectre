# Conventions — Style, Naming, and Errors

> **Template**. This document must be completed by every project that adopts SDD. It defines code style, naming, and project conventions.
>
> If you are adopting SDD for the first time, read the **Example** first and then the [How to Complete This Document](#how-to-complete-this-document) section.

---

## Language and Style

- **Primary language**: *(complete)*
- **Strict mode / linter**: *(complete)*
- **Formatter**: *(complete)*

### Example

- **Primary language**: TypeScript 5 with strict mode (`strict: true`).
- **Linter**: ESLint with `eslint-plugin-svelte` and `@typescript-eslint/recommended-type-checked`.
- **Formatter**: Prettier with 100-character line width.
- **Minimum quality**: code with TypeScript errors or lint warnings is not merged without justification.

---

## Naming

| Element | Convention | Example |
|---|---|---|
| Files | *(complete)* | `user-menu.ts` |
| Components / classes | *(complete)* | `Button` |
| Functions | *(complete)* | `sendNotification()` |
| Constants | *(complete)* | `MAX_RETRY_COUNT` |
| Types / interfaces | *(complete)* | `UserProfile` |
| Domain modules | *(complete)* | `modules/sales/` |

### Example

| Element | Convention | Example |
|---|---|---|
| TypeScript files | kebab-case | `client-form.svelte`, `client.service.ts` |
| Svelte components | PascalCase | `ClientForm.svelte` |
| Classes / types | PascalCase | `ClientRepository`, `CreateClientInput` |
| Functions | camelCase, verb first | `createClient()`, `formatCurrency()` |
| Local constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Boolean variables | `is`/`has`/`can` prefix | `isLoading`, `hasPermission` |
| Domain modules | kebab-case, plural | `modules/clients/`, `modules/opportunities/` |
| Files inside a module | `<entity>.<role>.ts` | `client.service.ts`, `client.repository.ts`, `client.policy.ts`, `client.types.ts` |
| Tests | `<file>.test.ts` next to the file or in `tests/unit/` | `client.service.test.ts` |
| Feature slugs | kebab-case, no accents, lowercase | `login-and-dashboard-layout` |

---

## Imports

Define the project's import order. Example:

1. External libraries.
2. Project aliases.
3. Local relative imports.

### Example

```typescript
// 1. External libraries
import { z } from 'zod';
import type { PageServerLoad } from './$types';

// 2. Project aliases ($lib/*)
import { db } from '$lib/server/db';
import { UnauthorizedError } from '$lib/shared/errors';

// 3. Local relative imports (same module)
import { clientSchema } from './client.schema';
import type { Client } from './client.types';
```

Additional rules:

- Use aliases (`$lib/`) instead of deep relative imports (`../../../../../`).
- Separate type imports (`import type`) from value imports when possible.
- Do not import from `src/` directly; use configured aliases.

---

## Errors

- Use named exceptions or typed results. Do not return `null` for domain errors.
- In UI, display error messages in the project's agreed language.
- Do not log sensitive data (PII).

### Example

Named domain errors:

```typescript
// $lib/shared/errors.ts
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(action: string) {
    super(`You do not have permission to ${action}.`);
    this.name = 'PermissionDeniedError';
  }
}
```

Usage in services:

```typescript
export async function getClientById(user: User, id: string): Promise<Client> {
  const client = await clientRepository.findById(id);
  if (!client) throw new NotFoundError('Client', id);
  if (!canReadClient(user, client)) throw new PermissionDeniedError('view this client');
  return client;
}
```

UI:

```svelte
{#if error instanceof PermissionDeniedError}
  <Alert variant="error">{error.message}</Alert>
{:else if error instanceof NotFoundError}
  <Alert variant="error">The requested client does not exist.</Alert>
{:else}
  <Alert variant="error">An unexpected error occurred. Please try again.</Alert>
{/if}
```

---

## Design Tokens

Capture the project's color palette, typography, and spacing here so designers do not use generic defaults. The Tech Lead fills this section during project setup.

- **Primary color**: *(complete, e.g. `#3B82F6`)*
- **Secondary / accent color**: *(complete, e.g. `#F59E0B`)*
- **Background color(s)**: *(complete, e.g. `#FFFFFF` / `#0F172A`)*
- **Text color(s)**: *(complete, e.g. `#111827` / `#F8FAFC`)*
- **Success color**: *(complete, e.g. `#22C55E`)*
- **Warning color**: *(complete, e.g. `#EAB308`)*
- **Error color**: *(complete, e.g. `#EF4444`)*
- **Font family**: *(complete, e.g. `Inter, system-ui, sans-serif`)*
- **Base spacing unit**: *(complete, e.g. `0.25rem` / `4px`)*

### Example

| Token | Value | Usage |
|---|---|---|
| Primary | `#3B82F6` | Buttons, links, active states |
| Background | `#FFFFFF` | Page background |
| Surface | `#F8FAFC` | Cards, panels |
| Text primary | `#111827` | Headings, body text |
| Text secondary | `#6B7280` | Captions, placeholders |
| Success | `#22C55E` | Success messages, confirmations |
| Warning | `#EAB308` | Warnings, pending states |
| Error | `#EF4444` | Errors, destructive actions |
| Font | `Inter, system-ui, sans-serif` | All UI text |
| Spacing unit | `4px` | Margins, paddings, gaps |

---

## UI and Copy

- **UI language**: *(complete)*
- **Date, number, and time formats**: *(complete)*
- **Breakpoints / responsive**: *(complete)*

### Example

- **UI language**: neutral English (no slang, no regionalisms). Error messages must be clear and action-oriented.
- **Dates**: `dd/MM/yyyy` for forms; `15 Jun 2025` for lists; ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`) in APIs.
- **Currency**: `$ 1,234.56` (USD, comma thousands separator, dot decimal separator).
- **Breakpoints**:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
- **Tone**: direct, no excessive exclamations, no blaming the user. Example:
  - ✅ "Enter a valid email address."
  - ❌ "Oops! Looks like you forgot your email."

---

## References

- For testing strategy and TDD: `sdd/testing.md`.
- For security, RBAC, and PII: `sdd/security.md`.
- For quality gates and Definition of Done: `sdd/quality-gates.md`.

---

## Project Setup Completion

This section is used by the Orchestrator to decide whether the project setup gate is complete. Do not remove it.

- [ ] **Language and Style** section has real tools (no `*(complete)*` placeholders).
- [ ] **Naming** table has real conventions for the project's stack.
- [ ] **Imports** order and aliases are defined.
- [ ] **Errors** strategy is chosen and documented with examples.
- [ ] **Design Tokens** section has real colors, typography, and spacing values.
- [ ] **UI and Copy** section has actual language, formats, and breakpoints.

## How to Complete This Document

1. Replace the "*(complete)*" fields in **Language and Style** with the project's actual tools.
2. Adapt the **Naming** table to your stack and existing conventions.
3. Define the **Imports** order and aliases used by the project.
4. Choose an **Errors** strategy (exceptions, typed results, or both) and document it with examples.
5. Complete **UI and Copy** with actual language, formats, and breakpoints.
6. Remove sections marked as **Example** when the document is mature, or keep them as reference while the team adopts SDD.
7. Check all boxes in the **Project Setup Completion** section above.
