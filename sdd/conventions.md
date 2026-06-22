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
- **Font family**: *(complete, e.g. `Inter` or `Geist` — Pencil.dev only accepts a single font family, not a CSS stack)*
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
| Font | `Inter` | All UI text |
| Spacing unit | `4px` | Margins, paddings, gaps |

---

## Design System

- **UI primitives library**: *(complete, e.g. shadcn-svelte, Bits UI, Tailwind UI, Radix UI, Material UI)*
- **Pencil Design System file**: default `sdd/design-system/design-system.pen`. If the project uses a shared Pencil file, the Design System lives as a dedicated page/frame inside that file.
- **Design System contents** (must be complete before feature design begins):
  - **Foundations** (stored as Pencil `variables` and visualized with valid Pencil nodes):
    - Colors: primary, secondary/accent, background, surface, text, success, warning, error.
    - Typography: one font family only (Pencil.dev only accepts a single value, e.g. `Inter` or `Geist`), type scale, weights, line heights.
    - Spacing: base unit and scale.
    - Radius: corner radius scale.
  - **Primitive/base components** (each is a `frame` with `reusable: true`, with variants/frames for default, hover, active, disabled, focus, error, and success states):
    - Button
    - Input
    - Card
    - Modal
    - Sheet
    - Avatar
    - Badge
    - Loading
    - Textarea, Select, Alert, Label (when the UI primitives library provides them).
- The Design System must exist in Pencil **before** any feature-specific visual design.
- Feature designs reuse the Design System primitives; new primitives are added to the Design System only when a feature genuinely needs them.
- Developers implement UI using the project's chosen UI primitives library, styled to match the Pencil Design System exactly.
- **Feature views do NOT live in `design-system.pen`**. Each feature has its own Pencil file at `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen`, built from the Design System primitives.

### Mapping Pencil → Code

| Pencil artifact | Code source |
|---|---|
| Design tokens | CSS variables / Tailwind theme / design tokens file |
| Primitive components | UI library primitives (shadcn, Bits UI, etc.) |
| Composite/feature components | Built from primitives, styled per Pencil frames |
| Layout patterns | Reused from Design System page frames |

## Visual Design Files

- **Default tool**: Pencil.dev, connected via MCP.
- **Pencil file per feature**: `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen`.
- **Pencil Design System file**: `sdd/design-system/design-system.pen` (or shared Pencil file page).
- The `.pen` file is JSON-based and must be tracked in Git. It must be a valid Pencil document using the native Pencil schema (e.g. `{"version": "2.13", "children": [...]}`). Do not use custom root schemas with fields like `tokens`, `primitives`, `layouts`, or `breakpoints`; document design tokens in this file and in `sdd/design-system/README.md` instead.
- **Only use valid Pencil node types** (see [Pencil Format Reference](#pencil-format-reference) below). Do not invent types such as `page`, `color-swatch`, `text-style`, `spacing-token`, `radius-token`, or `component`.
- Every new screen or component must exist in Pencil.dev before implementation begins.
- The Issue `[Design]` records frame/view identifiers, reusable component names, and design tokens so developers can replicate the design in code.

### Pencil Format Reference

This section prevents invalid `.pen` files. Consult https://docs.pencil.dev/for-developers/the-pen-format for the full specification.

**Valid node `type` values** (use only these; anything else will fail to open in Pencil):

```text
frame, group, rectangle, ellipse, polygon, path, text,
note, prompt, context, icon, script, ref
```

**Document structure:**

```json
{
  "version": "2.13",
  "variables": {
    "color.primary": { "type": "color", "value": "#3B82F6" },
    "color.accent": { "type": "color", "value": "#F59E0B" },
    "color.background": { "type": "color", "value": "#FFFFFF" },
    "color.surface": { "type": "color", "value": "#F8FAFC" },
    "color.text": { "type": "color", "value": "#111827" },
    "color.text-secondary": { "type": "color", "value": "#6B7280" },
    "color.success": { "type": "color", "value": "#22C55E" },
    "color.warning": { "type": "color", "value": "#EAB308" },
    "color.error": { "type": "color", "value": "#EF4444" },
    "font.family": { "type": "string", "value": "Inter" },
    "space.1": { "type": "number", "value": 4 },
    "space.2": { "type": "number", "value": 8 },
    "space.3": { "type": "number", "value": 12 },
    "space.4": { "type": "number", "value": 16 },
    "radius.base": { "type": "number", "value": 8 }
  },
  "children": [
    {
      "id": "foundations",
      "type": "frame",
      "name": "Foundations",
      "x": 0,
      "y": 0,
      "width": 1200,
      "height": 800,
      "children": [
        {
          "id": "colors-frame",
          "type": "frame",
          "name": "Colors",
          "x": 0,
          "y": 0,
          "width": 560,
          "height": 360,
          "children": [
            {
              "id": "primary-swatch",
              "type": "rectangle",
              "name": "Primary",
              "x": 16,
              "y": 16,
              "width": 48,
              "height": 48,
              "fill": "$color.primary",
              "cornerRadius": 8
            },
            {
              "id": "primary-label",
              "type": "text",
              "name": "Primary label",
              "x": 80,
              "y": 16,
              "width": 200,
              "height": 24,
              "content": "Primary",
              "fontFamily": "$font.family",
              "fontSize": 14
            }
          ]
        }
      ]
    }
  ]
}
```

**Rules to avoid "Failed to open" errors:**

1. Every node must have a `type` from the valid list above.
2. Every node must have an `id` (no `/` characters).
3. Every visual node must have `x`, `y`, `width`, and `height`.
4. Use `variables` at the document root for design tokens (colors, numbers, strings).
5. Reference variables with `$name`, e.g. `"fill": "$color.primary"`.
6. Use `frame` for pages/sections; do not use `page`.
7. Use `rectangle` with a `fill` for color swatches.
8. Use `text` nodes for typography samples and labels.
9. Use `frame` with `reusable: true` for base components; do not use `component`.
10. Use `ref` to instantiate reusable components elsewhere.
11. Do not use `color-swatch`, `text-style`, `spacing-token`, `radius-token`, or any other invented type.

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
- [ ] **Design System** section records the UI primitives library and the Pencil Design System file path.
- [ ] **Visual Design Files** section records the Pencil file location and MCP configuration.
- [ ] **UI and Copy** section has actual language, formats, and breakpoints.

## How to Complete This Document

1. Replace the "*(complete)*" fields in **Language and Style** with the project's actual tools.
2. Adapt the **Naming** table to your stack and existing conventions.
3. Define the **Imports** order and aliases used by the project.
4. Choose an **Errors** strategy (exceptions, typed results, or both) and document it with examples.
5. Complete **UI and Copy** with actual language, formats, and breakpoints.
6. Remove sections marked as **Example** when the document is mature, or keep them as reference while the team adopts SDD.
7. Check all boxes in the **Project Setup Completion** section above.
