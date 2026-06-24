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
- **Pencil Design System library file**: default `sdd/design-system/design-system.lib.pen`. This file is marked as a **Design Library** in Pencil so its components can be imported into any feature `.pen`.
- **Design System spec file**: `sdd/design-system/design-system-spec.md` — a concise map of tokens and primitive components written by the Designer before building the library.
- **How the Design System is created**:
  - The Tech Lead does **not** create the Design System file.
  - The Designer creates and populates `sdd/design-system/design-system.lib.pen` using the Pencil MCP server.
  - The Designer interviews the human to capture colors, typography, spacing, radius, and base components.
  - The Designer writes `sdd/design-system/design-system-spec.md` as the human-readable contract.
  - The human marks `design-system.lib.pen` as a Design Library in Pencil (Libraries panel → "Turn this file into a library").
  - Feature `.pen` files import this library and reuse its assets.
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
- The Design System library must exist and be marked as a library **before** any feature-specific visual design.
- Feature designs reuse the library assets; new primitives are added to the library only when a feature genuinely needs them.
- Developers implement UI using the project's chosen UI primitives library, styled to match the Pencil Design System exactly.
- **Feature views do NOT live in `design-system.lib.pen`**. Each feature has its own Pencil file at `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen`, built from the Design System library.

### Design System MCP Guide

This guide is for the human and Spectre. The human is the creative director in Pencil; Spectre assists with operational tasks. The Pencil MCP server is configured in **Spectre via `/mcp`**; it is not a dependency of the project.

**What Pencil is in this workflow**

- Pencil.dev is a **design tool connected to Spectre through an MCP server** (e.g. MCP name `pencil`).
- It does **not** live in `package.json`, `node_modules`, or the project `PATH`.
- It is **not** started, stopped, or authenticated from the project terminal. The human configures it once in Spectre (`/mcp`) and keeps the target `.pen` file open in the Pencil app / VS Code extension.
- Spectre interacts with Pencil **only** through the `mcp__pencil__*` tools when assisting the human; it never uses Bash (`pencil status`, `find`, `curl`, `lsof`) to check connectivity.

**Prerequisites**

- Pencil desktop app or VS Code extension installed on the human's machine.
- Pencil MCP server configured in **Spectre via `/mcp`** (e.g. MCP name `pencil`).
- Spectre confirms the connection by calling the Pencil MCP `get_editor_state` tool before any operational assistance.
- The target `.pen` file (Design System library or feature file) is open in Pencil so the MCP can operate on it.

**Step 1 — Create the document variables**

Using the MCP `set_variables` tool (or the Pencil variables panel), create these variables:

```json
{
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
  "space.5": { "type": "number", "value": 20 },
  "space.6": { "type": "number", "value": 24 },
  "space.8": { "type": "number", "value": 32 },
  "radius.none": { "type": "number", "value": 0 },
  "radius.small": { "type": "number", "value": 4 },
  "radius.base": { "type": "number", "value": 8 },
  "radius.medium": { "type": "number", "value": 12 },
  "radius.large": { "type": "number", "value": 16 },
  "radius.full": { "type": "number", "value": 9999 }
}
```

Adjust the hex values to the project's palette from the **Design Tokens** section above. The font family must be exactly one value (e.g. `Inter`).

**Step 2 — Create the Foundations frame**

Create a top-level `frame` named **Foundations** (`id: foundations`). Inside it create three child `frame`s:

1. **Colors** — one row per color token. Each row has:
   - a `rectangle` (`width`: 48, `height`: 48) with `fill: "$color.<name>"`
   - a `text` label with the token name and hex value
2. **Typography** — one `text` node per style (Heading XL, Heading LG, Heading MD, Heading SM, Body, Body Small, Caption) using `"fontFamily": "$font.family"`.
3. **Spacing & Radius** — a `frame` with labeled `rectangle` or `text` samples that reference `$space.*` and `$radius.*`.

**Step 3 — Create primitive components**

For each component (Button, Input, Card, Modal, Sheet, Avatar, Badge, Loading, and Textarea, Select, Alert, Label if applicable), create a top-level `frame` with `reusable: true`. Inside each component frame, create one child `frame` per state:

- default
- hover
- active
- disabled
- focus
- error
- success

Each state frame contains the actual Pencil nodes that represent that component state (rectangles, text, icons, etc.).

**Step 4 — Validate before closing**

- Every node has a valid `type` from the list in [Pencil Format Reference](#pencil-format-reference).
- Every node has `id`, `x`, `y`, `width`, `height`.
- All color, spacing, radius, and font values come from the document `variables`.
- Save the file so Git can track it.

### Troubleshooting Pencil MCP

| Symptom | Cause | Fix |
|---|---|---|
| `mcp__pencil__get_editor_state` fails or returns no tools | The `pencil` MCP is not connected in Spectre. | Open Spectre settings, add/configure the `pencil` MCP via `/mcp`, and ensure the server is running. |
| `get_editor_state` succeeds but the active file is wrong | The target `.pen` is not open in Pencil. | Open the expected file (`sdd/design-system/design-system.lib.pen` or the feature `.pen`) in the Pencil app / VS Code extension. |
| Changes disappear after closing | The file was not saved/exported from Pencil. | Save the file in Pencil so Git can track the updated `.pen`. |
| Agent tries `pencil status`, `curl`, or `find` | Outdated mental model: treating Pencil as a local CLI. | Stop the agent and remind it: Pencil is an MCP server; the only diagnostic is `mcp__pencil__get_editor_state`. |

### Mapping Pencil → Code

| Pencil artifact | Code source |
|---|---|
| Design tokens | CSS variables / Tailwind theme / design tokens file |
| Primitive components | UI library primitives (shadcn, Bits UI, etc.) |
| Composite/feature components | Built from primitives, styled per Pencil frames |
| Layout patterns | Reused from Design System page frames |

### Design → Code workflow

The default implementation flow is **Design → Code**:

1. The Developer opens the feature `.pen` and the Design System `.lib.pen` in Pencil.
2. The Developer uses Pencil AI (`Cmd/Ctrl+K`) or `export_html` (html-tailwind) to generate a starting point.
3. The Developer adapts the generated code to the project's stack and UI primitives library.
4. The Developer runs TDD for each `R<n>` from the approved `[Design]`.

If Pencil AI does not produce usable code, fall back to the HTML export as a visual reference and build manually from the Design System primitives.

### Design Library usage

1. Create and populate `sdd/design-system/design-system.lib.pen`.
2. In Pencil, open the Libraries panel and click **"Turn this file into a library"**.
3. In each feature `.pen`, open the Libraries panel and import `sdd/design-system/design-system.lib.pen`.
4. Drag assets from the Assets panel onto the feature canvas.

> A file marked as a Design Library cannot be unmarked. Make sure the Design System is stable before converting it.

## Visual Design Files

- **Default tool**: Pencil.dev, connected via MCP.
- **Design System library**: `sdd/design-system/design-system.lib.pen` — marked as a Design Library in Pencil and imported into feature files.
- **Pencil file per feature**: `sdd/features/<feature-slug>/design/assets/<feature-slug>.pen`.
- The `.pen` file is JSON-based and must be tracked in Git. It must be a valid Pencil document using the native Pencil schema (e.g. `{"version": "2.13", "children": [...]}`). Do not use custom root schemas with fields like `tokens`, `primitives`, `layouts`, or `breakpoints`; document design tokens in `sdd/design-system/design-system-spec.md` instead.
- **Only use valid Pencil node types** (see [Pencil Format Reference](#pencil-format-reference) below). Do not invent types such as `page`, `color-swatch`, `text-style`, `spacing-token`, `radius-token`, or `component`.
- Every new screen or component must exist in Pencil.dev before implementation begins.
- Feature files must import the Design System library via the Pencil Libraries panel before designing.
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
- [ ] **Design System** section records the UI primitives library and the Pencil Design System library file path (`design-system.lib.pen`).
- [ ] **Visual Design Files** section records the Pencil file location, Design Library usage, and MCP configuration.
- [ ] **UI and Copy** section has actual language, formats, and breakpoints.

## How to Complete This Document

1. Replace the "*(complete)*" fields in **Language and Style** with the project's actual tools.
2. Adapt the **Naming** table to your stack and existing conventions.
3. Define the **Imports** order and aliases used by the project.
4. Choose an **Errors** strategy (exceptions, typed results, or both) and document it with examples.
5. Complete **UI and Copy** with actual language, formats, and breakpoints.
6. Remove sections marked as **Example** when the document is mature, or keep them as reference while the team adopts SDD.
7. Check all boxes in the **Project Setup Completion** section above.
