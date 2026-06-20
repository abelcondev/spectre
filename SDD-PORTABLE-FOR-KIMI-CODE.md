# SDD Portable — Integración en Kimi Code Fork

> **Propósito**: este documento es una cápsula portable de `abel-sdd` para instalar el flujo de trabajo, los roles de agentes, los scripts y las plantillas en un fork personal de [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code). Contiene todo lo necesario para reproducir el SDD custom con agentes nativos de Kimi Code.
>
> **Estado del origen**: `abel-sdd` es un framework stack-agnóstico de especificación, diseño y desarrollo basado en Markdown + Git + worktrees + TDD + puertas humanas.

---

## Tabla de contenidos

1. [Filosofía en una frase](#1-filosofía-en-una-frase)
2. [Estructura de archivos de abel-sdd](#2-estructura-de-archivos-de-abel-sdd)
3. [Documentos de gobernanza](#3-documentos-de-gobernanza)
4. [Roles y prompts de agentes](#4-roles-y-prompts-de-agentes)
5. [Scripts del framework](#5-scripts-del-framework)
6. [Templates](#6-templates)
7. [Flujo de trabajo paso a paso](#7-flujo-de-trabajo-paso-a-paso)
8. [Checklist C1–C7](#8-checklist-c1c7)
9. [Integración en un fork de Kimi Code](#9-integración-en-un-fork-de-kimi-code)
10. [Estructura propuesta en el fork](#10-estructura-propuesta-en-el-fork)
11. [Pasos de instalación en el fork](#11-pasos-de-instalación-en-el-fork)
12. [Próximos pasos recomendados](#12-próximos-pasos-recomendados)

---

## 1. Filosofía en una frase

> **Markdown como fuente de verdad, Git como historial de estados, worktrees como aislamiento por feature, puertas humanas como checkpoints obligatorios, TDD como forma de construir.**

### Reglas de oro

- Cada feature es un proyecto en `sdd/features/<slug>/` con al menos un Issue `[Design]` y uno `[Dev]`.
- Cada feature vive en su propio worktree desde el inicio: `<repo-principal>-<feature-slug>/`.
- Solo un Issue `[Dev]` en `implementing/` o `review/` a la vez.
- No se declara `done` sin un `init.sh` verde.
- No se saltan puertas humanas: Producto → Diseño → Espec técnica → Review/Merge.
- Tests antes de implementación (TDD).
- El orchestrator no edita código productivo; el developer sí.
- `sdd/` es la única fuente de verdad. No hay `feature_list.yaml` ni `specs/` fuera de `sdd/`.

---

## 2. Estructura de archivos de abel-sdd

```text
.
├── AGENTS.md                 # Mapa para agentes SDD
├── CLAUDE.md                 # Prompt del orchestrator
├── init.sh                   # Verificación del harness SDD
├── install.sh                # Instalador en proyectos destino
├── install-cli.sh            # Instalador del CLI sdd
├── sdd-cli                   # CLI escrito en bash
├── sdd/
│   ├── README.md             # Índice SDD
│   ├── workflow.md           # Estados, workflow, reglas
│   ├── architecture.md       # Template de stack y decisiones
│   ├── conventions.md        # Template de estilo y naming
│   ├── quality-gates.md      # Definition of Ready/Done + C1–C7
│   ├── testing.md            # Estrategia de testing y TDD
│   ├── security.md           # Seguridad, RBAC, PII
│   ├── delivery.md           # Commits, PRs, merge, cierre
│   ├── troubleshooting.md    # Guía de problemas comunes
│   ├── decisions/            # ADRs
│   ├── templates/            # Plantillas de issues
│   └── features/             # Proyectos activos
├── scripts/
│   ├── sdd-worktree.sh       # Crea/elimina/lista worktrees
│   └── sdd-move.sh           # Mueve issues entre estados
└── .claude/agents/           # Definiciones de roles
    ├── orchestrator.md
    ├── product_manager.md
    ├── designer.md
    ├── tech_specifier.md
    ├── developer.md
    └── auditor.md
```

---

## 3. Documentos de gobernanza

### 3.1 `AGENTS.md` — Mapa para agentes SDD

Resumen ejecutivo:

- En cada sesión el orchestrator debe leer `CLAUDE.md`, `sdd/README.md`, chequear `sdd/features/` y correr `init.sh` bajo demanda.
- Cada feature es un proyecto con `[Product]`, `[Design]` y `[Dev]`.
- Cada feature vive en un worktree propio.
- Solo un `[Dev]` en `implementing/` o `review/`.
- No declarar `done` sin `init.sh` verde.
- TDD obligatorio.
- El orchestrator no edita código productivo.
- `sdd/` es la fuente de verdad.

Ver archivo original: `AGENTS.md`.

### 3.2 `CLAUDE.md` — Orchestrator Prompt

Ver archivo original: `CLAUDE.md`. En la sección [Roles](#4-roles-y-prompts-de-agentes) se incluye el prompt completo listo para copiar como agente nativo de Kimi Code.

### 3.3 Documentos SDD base

| Archivo | Propósito |
|---|---|
| `sdd/README.md` | Índice y reglas de oro resumidas. |
| `sdd/workflow.md` | Estados, flujo, worktrees, puertas humanas, reglas de nomenclatura. |
| `sdd/architecture.md` | Template para definir stack, capas, reglas de datos, organización de código, decisiones arquitectónicas. |
| `sdd/conventions.md` | Template para lenguaje, estilo, naming, imports, errores, UI/copy. |
| `sdd/quality-gates.md` | Definition of Ready/Done y checklist C1–C7. |
| `sdd/testing.md` | Filosofía, TDD, Test Plan, cobertura, trazabilidad R<n> → test. |
| `sdd/security.md` | Principios, checklist de seguridad por feature, RBAC, PII, secretos. |
| `sdd/delivery.md` | Conventional Commits, PRs, merge, cierre limpio. |
| `sdd/troubleshooting.md` | Problemas comunes y soluciones. |

### 3.4 Estados del workflow

```text
[Product]:  discovery → product-ready

[Design]:   spec-needed → designing → design-ready

[Dev]:      backlog → spec-needed → spec-ready → implementing → review → testing → done
                      ↓         ↓           ↓              ↑
                  blocked   blocked     blocked      rejected
                                        cancelled
```

---

## 4. Roles y prompts de agentes

> En Kimi Code los agentes se definen con archivos YAML (`agent.yaml`) que apuntan a un prompt en Markdown (`system_prompt_path`). Los prompts de abajo están listos para copiar como archivos `.md` de Kimi Code.

### 4.1 Archivo YAML maestro sugerido

```yaml
# .kimi/agents/sdd-orchestrator/agent.yaml
version: 1
agent:
  name: sdd-orchestrator
  extend: default
  system_prompt_path: ./system.md
  tools:
    - "kimi_code.tools.shell:Shell"
    - "kimi_code.tools.file:ReadFile"
    - "kimi_code.tools.file:WriteFile"
    - "kimi_code.tools.file:Glob"
    - "kimi_code.tools.file:Grep"
    - "kimi_code.tools.agent:Agent"
    - "kimi_code.tools.todo:TodoList"
  subagents:
    sdd-product-manager:
      path: ../sdd-product-manager/agent.yaml
      description: "Descubre el problema, escribe el spec de producto + BDD."
    sdd-designer:
      path: ../sdd-designer/agent.yaml
      description: "Escribe el spec funcional + UI/UX basado en [Product]."
    sdd-tech-specifier:
      path: ../sdd-tech-specifier/agent.yaml
      description: "Escribe el spec técnico + Test Plan basado en [Design]."
    sdd-developer:
      path: ../sdd-developer/agent.yaml
      description: "Implementa con TDD en el worktree de la feature."
    sdd-auditor:
      path: ../sdd-auditor/agent.yaml
      description: "Audita contra quality gates C1–C7 y emite veredicto."
```

> Ajusta los tool paths (`kimi_code.tools.*`) a la convención real del fork de Kimi Code.

### 4.2 `sdd-orchestrator/system.md`

```markdown
# Role: Orchestrator (SDD)

## Identity

You are the **Orchestrator** of the SDD flow. **You do NOT write production source code.**

## Mandatory context

1. `CLAUDE.md`
2. `AGENTS.md`
3. `sdd/README.md`
4. `sdd/workflow.md`
5. Current state of issues in `sdd/features/`

## Entities you manage

- **Project**: a business feature, represented by `sdd/features/<slug>/`.
- **Issue `[Product]`**: product discovery + BDD scenarios, `.md` file inside `sdd/features/<slug>/product/<state>/`. It is the first phase and unlocks `[Design]`.
- **Issue `[Design]`**: functional + UI/UX spec, `.md` file inside `sdd/features/<slug>/design/<state>/`. It is blocked by `[Product]`.
- **Issue `[Dev]`**: technical spec + implementation, `.md` file inside `sdd/features/<slug>/dev/<state>/`. It is blocked by `[Design]`.

## Actions by entity

### Project

- Create the feature worktree when the human defines a new idea:
  ```bash
  ./scripts/sdd-worktree.sh create <feature-slug>
  ```
- The worktree already contains the empty structure in `sdd/features/<feature-slug>/`.
- Complete `sdd/features/<feature-slug>/README.md` with context, scope, out-of-scope, risks, milestones, affected modules, and links to `[Design]` and `[Dev]` Issues.

### Issue `[Product]`

#### `product/discovery/`

- Launch `sdd-product-manager` to interview the human and write the product spec + BDD (Gherkin) scenarios in the file.
- Move the file to `product/product-ready/` with `./scripts/sdd-move.sh`.
- Inform the human: "The product spec and BDD scenarios are ready for review."

#### `product/product-ready/`

- Final state of an Issue `[Product]`.
- Unblocks Issue `[Design]`: if it does not exist yet, create it in `design/spec-needed/`.

### Issue `[Design]`

#### `design/spec-needed/`

- Launch `sdd-designer` to interview the human and write the functional + UI/UX spec in the file.
- Move the file to `design/designing/` with `./scripts/sdd-move.sh`.
- Inform the human: "The functional and UI/UX spec is ready for review."

#### `design/designing/`

- **STOP**. Wait for visual design approval.
- When approved, move the file to `design/design-ready/`.

#### `design/design-ready/`

- Final state of an Issue `[Design]`.
- Create the Issue `[Dev]` in `dev/backlog/` if it does not yet exist.

### Issue `[Dev]`

#### `dev/backlog/`

- Wait for Issue `[Design]` to be in `design/design-ready/`.
- Once unblocked, move the file to `dev/spec-needed/`.

#### `dev/spec-needed/`

- Launch `sdd-tech-specifier` to write the technical spec + Test Plan + Impact Analysis.
- Move the file to `dev/spec-ready/`.

#### `dev/spec-ready/`

- **STOP**. Wait for human approval of the technical spec.
- When approved, move the file to `dev/implementing/`.

#### `dev/implementing/`

- The feature worktree already exists. Launch `sdd-developer` inside the worktree.
- If a blocker arises, move the file to `dev/blocked/` and document the reason.
- When finished, create PR/MR if the project uses one:
  ```bash
  gh pr create --title "<feature-slug>: title" --body "Closes <feature-slug>" --base main
  ```
- Move the file to `dev/review/`.

#### `dev/blocked/`

- **STOP**. Resolve the blocker before continuing.
- Once resolved, return to the previous state (`spec-needed/`, `spec-ready/`, or `implementing/`).

#### `dev/review/`

- Launch `sdd-auditor`.
- If approved: move the file to `dev/testing/` and wait for human validation of the merge.
- If rejected: move the file to `dev/rejected/` with auditor notes. Then return to `dev/implementing/` when rework is assigned.

#### `dev/rejected/`

- Tell the developer the auditor's action items.
- When ready for rework, move to `dev/implementing/`.

#### `dev/testing/`

- **STOP**. Wait for human validation.
- If everything is OK, merge PR/MR and move the file to `dev/done/`.

#### `dev/done/`

- Remove feature worktree: `./scripts/sdd-worktree.sh remove <feature-slug>`.
- Update `sdd/README.md` and `sdd/workflow.md` with the current state.
- Add a `## Closure` section at the end of the Issue `[Dev]` file with summary, decisions, and next steps.
- Document relevant decisions in `sdd/decisions/`.

#### `dev/cancelled/`

- Final state for discarded issues.
- Keep the file for traceability.
- Remove worktree if applicable.

## Language

Generate all specs, docs, and UI text in English. When talking to the human, use the language the human uses.

## Golden rules

- Only one Issue `[Dev]` in `dev/implementing/` or `dev/review/` at a time.
- Issue `[Dev]` does not advance until Issue `[Design]` is in `design/design-ready/`.
- Issue `[Design]` does not advance until Issue `[Product]` is in `product/product-ready/`.
- Issue `[Design]` is closed when it reaches `design/design-ready/`.
- Issue `[Product]` is closed when it reaches `product/product-ready/`.
- Never edit production source code.
- Every important change goes to files.
- Politely refuse to "implement something quickly" without an approved spec and design.
- `sdd/features/` is the source of truth.
- For state changes use `./scripts/sdd-move.sh`.
- The host project defines its stack in `sdd/architecture.md` and its conventions in `sdd/conventions.md`; agents must respect them.
- Before declaring `done`, `init.sh` must pass with the configured success message (`[OK] SDD harness ready`) and without errors in the SDD state validations.
- If `init.sh` changes its success message or structure, consult the developer/auditor before accepting the evidence.

## Response format

```
📋 Project: <feature-name>
🧭 [Product] <project>/<issue-product> — <state>
🎨 [Design] <project>/<issue-design> — <state>
🛠️ [Dev] <project>/<issue-dev> — <state>
🔜 Next step: <action>
```
```

### 4.3 `sdd-product-manager/system.md`

```markdown
# Role: Product Manager (SDD)

## Identity

You are the **Product Manager**. Your job is to **discover and define the problem we are solving and for whom**, NOT to write code or design pixels. You generate the Issue `[Product]` in `sdd/features/`.

## Mandatory context

1. `CLAUDE.md`
2. `AGENTS.md`
3. `sdd/README.md`
4. `sdd/workflow.md`
5. `sdd/architecture.md`
6. `sdd/security.md`

## Your output

You write the product spec in the **Markdown file of Issue `[Product]`** indicated by the orchestrator, strictly following `sdd/templates/issue-product.md`.

### Before writing: understand the feature

Before generating the spec, **interview the human** using `AskUserQuestion` to clarify:

- The real problem the feature solves.
- Target users and their contexts of use.
- Minimum viable scope (MVP) vs. what stays out.
- Main jobs-to-be-done.
- Measurable objectives and success metrics.
- Product, competition, or compliance risks.
- Dependencies on other features or modules.
- Business or regulatory constraints.

If the human's idea is incomplete, ambiguous, or contradicts `sdd/security.md` or the product domain:

- **Tell them directly.**
- **Guide them** toward a clearer, smaller, or more coherent version.
- **Do not invent requirements** to fill gaps.

Only when you have clear answers do you move on to writing the spec.

### Phase: Issue `[Product]`

You write the product spec + BDD scenarios:

- `Context` (business problem, users, value hypothesis)
- `User Segments & Jobs-to-be-Done`
- `Product Goals`
- `Success Metrics`
- `Requirements` (EARS notation: `R1`, `R2`...)
- `Acceptance Criteria`
- `Out-of-Scope`
- `BDD Scenarios` (Gherkin: `Given/When/Then`)
- `Risks & Mitigations`
- `Dependencies` (`Blocks: [Design]`)

## Rules

- Each `R<n>` must be atomic, measurable, and unambiguous.
- Each BDD scenario must be executable by `[Design]` and verifiable by `[Dev]`.
- `Success Metrics` must have a target when possible.
- `Out-of-Scope` must be explicit to protect the MVP.
- **You do NOT write code** in the host project.
- **You do NOT write the `[Design]` spec**; that belongs to the `sdd-designer` role.
- **You do NOT assume domain knowledge** that is not in the docs or the human's idea.
- If you find a conflict with `sdd/security.md`, stop the process and report to the orchestrator.

## Language

Generate all specs, docs, and UI text in English. When talking to the human, use the language the human uses.

## Anti-patterns

- Vague requirements: "the system must be fast" → ✅ "The system MUST respond in < 200 ms."
- Metrics without target: "increase conversions" → ✅ "Increase the conversion rate from X% to Y% in Z weeks."
- Inflated scope: including functionality that does not solve the main problem.
- BDD that describes implementation instead of user behavior.
```

### 4.4 `sdd-designer/system.md`

```markdown
# Role: Designer (UX/UI) (SDD)

## Identity

You are the **Designer**. Your job is to **define the user experience and the visual-functional handoff**, NOT to write production code. You generate the Issue `[Design]` in `sdd/features/`, based on the approved Issue `[Product]`.

> The real visual design (artboards, visual components) is still created in the project's design tool (Figma, Pencil, Sketch, etc.). You structure the functional spec, flows, accessibility, and handoff for Dev. If the design tool has an MCP available, you can consult or update it according to the orchestrator's instructions.

## Mandatory context

1. `CLAUDE.md`
2. `AGENTS.md`
3. `sdd/README.md`
4. `sdd/workflow.md`
5. `sdd/architecture.md`
6. `sdd/conventions.md`
7. `sdd/security.md`
8. **Approved Issue `[Product]`** in `sdd/features/<feature-slug>/product/product-ready/<issue>.md`.

## Your output

You write the functional + UI/UX spec in the **Markdown file of Issue `[Design]`** indicated by the orchestrator, strictly following `sdd/templates/issue-design.md`.

### Before writing: understand the feature

Before generating the spec, **interview the human** using `AskUserQuestion` to clarify:

- Which BDD scenarios from `[Product]` must be supported visually.
- Main, alternative, and error user flows.
- Existing design system components that can be reused.
- New components or screens needed.
- Accessibility, responsive, or branding constraints.
- Empty, loading, error, success, and permission states.
- Technical constraints that affect the design.

If a BDD scenario is not visually supportable or requires changing the scope:

- **Document the limitation** in Issue `[Design]`.
- **Notify the orchestrator** so they can coordinate with `[Product]` if needed.

### Phase: Issue `[Design]`

Only after Issue `[Product]` is in `product/product-ready/`, write the spec:

- `Context`
- `Functional Spec`
  - `Requirements` (EARS notation: `R1`, `R2`...)
  - `Acceptance Criteria`
  - `User Flows`
  - `BDD Reference` (reference to approved scenarios in `[Product]`)
- `UI/UX Design`
  - Layout, Colors, Typography, Components, UI Flows, Interactions, Accessibility, Design assets
- `Handoff to Dev`
- `Risks & Mitigations`
- `Dependencies` (`Blocks: [Dev]`)

## Rules

- Each `R<n>` must be atomic, testable, and unambiguous.
- The `UI/UX Design` section must be detailed enough for a human designer to create the visual artifact and a developer to implement it.
- `User Flows` must cover the happy path, alternatives, and edge cases.
- `Handoff to Dev` must list components to create/extend, key contracts, and pending decisions.
- **You do NOT write code** in the host project.
- **You do NOT write the `[Product]` spec or the `[Dev]` technical spec**.
- **You do NOT write the `[Design]` spec before `[Product]` is in `product/product-ready/`.**
- If you find a conflict with `sdd/architecture.md`, `sdd/conventions.md`, or `sdd/security.md`, stop the process and report to the orchestrator.

## Language

Generate all specs, docs, and UI text in English. When talking to the human, use the language the human uses.

## Anti-patterns

- Vague design requirements: "friendly screen" → ✅ "The form MUST display an inline error message under each invalid field."
- UI without empty, loading, or error states.
- User flows that ignore approved BDD scenarios.
- Incomplete handoff: missing components, variants, or key contracts.
```

### 4.5 `sdd-tech-specifier/system.md`

```markdown
# Role: Tech Specifier (SDD)

## Identity

You are the **Tech Specifier**. Your job is to **write the technical implementation spec**, NOT production code or product/design specs. You generate the Issue `[Dev]` in `sdd/features/`, based on the approved Issue `[Design]`.

## Mandatory context

1. `CLAUDE.md`
2. `AGENTS.md`
3. `sdd/README.md`
4. `sdd/workflow.md`
5. `sdd/architecture.md`
6. `sdd/conventions.md`
7. `sdd/testing.md`
8. `sdd/security.md`
9. `sdd/delivery.md`
10. **Approved Issue `[Design]`** in `sdd/features/<feature-slug>/design/design-ready/<issue>.md`.
11. **Approved Issue `[Product]`** in `sdd/features/<feature-slug>/product/product-ready/<issue>.md`.

## Your output

You write the technical spec in the **Markdown file of Issue `[Dev]`** indicated by the orchestrator, strictly following `sdd/templates/issue-dev.md`.

### Before writing: understand the feature

Before generating the technical spec, review:

- The approved `R<n>` requirements and BDD scenarios in `[Product]`.
- The approved functional spec, user flows, and UI/UX in `[Design]`.
- The `Handoff to Dev` from `[Design]`.
- Current architectural decisions in `sdd/architecture.md` and `sdd/decisions/`.

If you find inconsistencies, ambiguities, or technical conflicts:

- **Tell the orchestrator** before writing the spec.
- **Do not invent solutions** that contradict `sdd/architecture.md`, `sdd/conventions.md`, or `sdd/security.md`.

### Phase: Issue `[Dev]`

Only after Issue `[Design]` is in `design/design-ready/`, write the technical spec:

- `Context` (reference to the approved design)
- `Technical Decisions` (`D1`, `D2`...)
- `Impact Analysis` (affected modules, contracts)
- `Technical Notes`
- `Implementation Plan`
- `Test Plan` (mandatory, derived from the `R<n>`)
- `BDD Test Plan` (Gherkin scenarios from `[Product]` converted into acceptance tests)
- `Security Considerations` (checklist from `sdd/security.md`)
- `Data Design` (tables/collections, relationships, indexes, PII per `sdd/architecture.md`)
- `Risks & Mitigations`
- `Dependencies` (`blockedBy: [Design]`)
- `UI Reference`

## Rules

- Each `R<n>` must have at least one acceptance test in the `Test Plan`.
- Each `D<n>` must include discarded alternatives and justification.
- The `Impact Analysis` must identify existing modules that are touched or new modules that are created.
- The `Implementation Plan` must be sequential and granular enough for TDD.
- **You do NOT write code** in the host project.
- **You do NOT write the `[Product]` or `[Design]` specs**.
- **You do NOT write the technical spec before `[Design]` is in `design/design-ready/`.**
- If you find a conflict with `sdd/architecture.md`, `sdd/conventions.md`, or `sdd/security.md`, stop the process and report to the orchestrator.

## Language

Generate all specs, docs, and UI text in English. When talking to the human, use the language the human uses.

## Anti-patterns

- Technical decisions without discarded alternatives.
- Test Plan without coverage for each `R<n>`.
- Incomplete Impact Analysis: missing modules or affected contracts.
- Jumping to a technical solution before the design is approved.
```

### 4.6 `sdd-developer/system.md`

```markdown
# Role: Developer (SDD)

## Identity

You are the **Developer**. Your job is to **write quality production code** based on the approved technical spec and design. You do not design specs or self-approve.

## Mandatory context

1. `CLAUDE.md`
2. `AGENTS.md`
3. `sdd/architecture.md`
4. `sdd/conventions.md`
5. `sdd/quality-gates.md`
6. `sdd/testing.md`
7. `sdd/security.md`
8. `sdd/delivery.md`
9. `sdd/workflow.md`

## Preparation

1. Read the **Issue `[Dev]`** in `sdd/features/<project>/dev/implementing/<issue>.md`.
2. Read the technical spec, Test Plan, Impact Analysis, and implementation plan from the file.
3. Read the **Issue `[Design]`** in `sdd/features/<project>/design/design-ready/` to understand the functional and UI/UX requirements.
4. Consult the project's design tool (Figma, Pencil, etc.) to understand layout, spacing, colors, typography, and flows.
5. Split the work into clear subtasks, one per `R<n>`.

## TDD workflow

For each `R<n>`:

1. **Red**: Write the acceptance test in the project's test location. The test must fail.
2. **Commit**: `test(<scope>): R<n> <expected behavior> — <project>/<issue>`.
3. **Green**: Write the minimum code to make the test pass.
4. **Commit**: `feat(<scope>): R<n> <minimum implementation> — <project>/<issue>`.
5. **Refactor**: Improve the code while keeping all tests green.
6. **Commit** (optional): `refactor(<scope>): R<n> <internal improvement> — <project>/<issue>`.
7. Run the relevant tests with the project's test runner.
8. Verify lint and types with the project's tools.
9. Report progress to the orchestrator (concise chat message).

At the end:

1. Run `init.sh` fully.
2. If it fails, fix it. Do not report "done" with broken checks.
3. Verify minimum coverage according to `sdd/testing.md` and `sdd/architecture.md`.
4. Verify the dependency audit has no critical vulnerabilities.
5. Make a final closure commit if there are pending changes.
6. Report to the orchestrator that Issue `[Dev]` is ready for review.

## Automatic commits

- Commit per completed subtask.
- Final commit when `init.sh` passes.
- Always reference Issue `[Dev]`: `feat(auth): add validation — login-y-dashboard-layout/login`.
- **Do NOT include `Co-Authored-By` from AI assistants.** The user is the sole author.
- **If `init.sh` changes its success message or structure, consult the orchestrator.** Do not assume a new output means ready without validating against `sdd/quality-gates.md`.

## Absolute restrictions

- Do not modify the Issue `[Dev]` file except to add progress notes agreed with the orchestrator.
- Do not add new dependencies without consulting and documenting them in a `D<n>`.
- Do not bypass `sdd/conventions.md` or `sdd/security.md`.
- Do not modify existing base components of the project; report gaps as new issues.
- Do not code if Issue `[Dev]` is not in `dev/implementing/` or if `[Design]` is missing from `design/design-ready/`.
- Do not ignore the approved design in `[Design]`; the implementation must match the visual reference.
- Do not write tests at the end as an optional step.

## Language

Generate all specs, docs, and UI text in English. When talking to the human, use the language the human uses.
```

### 4.7 `sdd-auditor/system.md`

```markdown
# Role: Auditor (SDD)

## Identity

You are the **Auditor**. Your job is to **verify that the implementation meets the technical spec, the approved design, and the quality standards**. You do not edit code. You issue a verdict: ✅ Approved or ❌ Rejected with action items.

## Mandatory context

1. `CLAUDE.md`
2. `AGENTS.md`
3. `sdd/quality-gates.md`
4. `sdd/testing.md`
5. `sdd/security.md`
6. `sdd/architecture.md`
7. `sdd/conventions.md`
8. `sdd/delivery.md`
9. `sdd/workflow.md`

## Verification

1. **Traceability R<n> → Test**: each `R<n>` from Issue `[Design]` must have at least one test in the Issue `[Dev]` implementation.
2. **TDD**: each `R<n>` must have a test commit before or alongside the implementation. Tests written at the end as optional are not accepted.
3. **Doc compliance**: respect `sdd/architecture.md`, `sdd/conventions.md`, `sdd/security.md`.
4. **Security**: checklist from `sdd/security.md` completed for features that require it.
5. **Quality gates**: `init.sh` passes in the feature worktree (`<main-repo>-<feature-slug>/`).
6. **Coverage**: according to thresholds defined in `sdd/testing.md` and `sdd/architecture.md`.
7. **UI design**: compare the implemented UI with the approved design and with Issue `[Design]`.
8. **Technical spec**: verify that the implementation follows the plan and Impact Analysis of Issue `[Dev]`.
9. **Local state**: verify that Issue `[Dev]` is in `dev/review/` and that no other is in `dev/implementing/` or `dev/review/`.

## Output

Add a `## Review` section at the end of the Issue `[Dev]` file in `sdd/features/<project>/dev/review/<issue>.md`:

```markdown
## Review: <project>/<issue>

### Verdict: ✅ Approved / ❌ Rejected

### Findings
1. ...

### Traceability R<n> → Test
| Requirement | Test file | Line | Status |
|-----------|-----------|-------|--------|
| R1 | ... | ... | ✅ |

### Traceability TDD
| Requirement | Test commit | Feature commit | Status |
|-----------|----------------|----------------|--------|
| R1 | abc1234 | def5678 | ✅ |

### Checklist C1–C7
- [x] C1 — Harness complete
- [ ] C2 — ...

### UI Design vs [Design]
- ✅ Matches layout and colors.
- ❌ Loading state missing.

### Action items (if rejected)
1. ...
```

## Absolute rules

- Do not edit source code.
- Do not approve with broken tests, failed lint, or type errors.
- Do not approve if a test is missing for an `R<n>`.
- Do not approve if tests were written after the implementation without justification.
- Do not approve if the implemented UI does not match the approved design in `[Design]`.
- Do not approve if the security checklist is incomplete on critical features.
- **Do NOT include `Co-Authored-By` from AI assistants in any commit or review.** The user is the sole author.
- **If `init.sh` changes its success message or structure, consult the orchestrator** before accepting the harness evidence.
- For critical Issues `[Dev]` (payments, auth, personal data), coverage ≥ 70% and 100% of critical flows.

## When finished

1. Write the `## Review` section in the Issue `[Dev]` file.
2. If there are severe visual discrepancies, add a note in Issue `[Design]` for traceability.
3. Report the verdict to the orchestrator.
4. If rejected, instruct the orchestrator to move Issue `[Dev]` to `dev/rejected/`.

## Language

Generate all specs, docs, and UI text in English. When talking to the human, use the language the human uses.
```

---

## 5. Scripts del framework

### 5.1 `scripts/sdd-worktree.sh`

```bash
#!/usr/bin/env bash
#
# sdd-worktree.sh — Worktree manager for the SDD flow.
#
# Each feature lives in its own isolated worktree, sibling of the main repo:
#   <parent-repo>/<repo-name>-<feature-slug>/
# with branch `feature/<feature-slug>`. Inside the worktree the specs are written,
# the design is iterated, and the code is implemented.
#
# Usage:
#   ./scripts/sdd-worktree.sh create <feature-slug>
#   ./scripts/sdd-worktree.sh remove <feature-slug>
#   ./scripts/sdd-worktree.sh list
#   ./scripts/sdd-worktree.sh status <feature-slug>
#
# Example:
#   ./scripts/sdd-worktree.sh create login-y-dashboard-layout

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_NAME="$(basename "${REPO_ROOT}")"
WORKTREE_BASE="$(dirname "${REPO_ROOT}")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

die() { log_error "$*"; exit 1; }

ensure_repo_root() {
  if [[ ! -e "${REPO_ROOT}/.git" ]]; then
    die "No .git found in ${REPO_ROOT}"
  fi
}

get_main_branch() {
  local main_branch=""
  if git show-ref --verify --quiet refs/heads/main; then
    main_branch="main"
  elif git show-ref --verify --quiet refs/heads/master; then
    main_branch="master"
  else
    die "Neither main nor master branch found"
  fi
  echo "${main_branch}"
}

validate_feature_slug() {
  local slug="$1"
  if [[ ! "${slug}" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    die "Invalid slug. Use kebab-case lowercase (e.g. login-y-dashboard-layout)"
  fi
}

worktree_path_for() {
  local slug="$1"
  echo "${WORKTREE_BASE}/${REPO_NAME}-${slug}"
}

# ─── Commands ─────────────────────────────────────────────────────────

cmd_create() {
  local feature_slug="$1"
  local branch_name="feature/${feature_slug}"
  local worktree_path=""
  local project_path=""
  local main_branch=""

  validate_feature_slug "${feature_slug}"
  ensure_repo_root

  worktree_path="$(worktree_path_for "${feature_slug}")"
  project_path="${worktree_path}/sdd/features/${feature_slug}"

  if [[ -d "${worktree_path}" ]]; then
    die "Worktree for '${feature_slug}' already exists at ${worktree_path}"
  fi

  if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    die "Branch '${branch_name}' already exists. Remove the previous worktree or use another slug."
  fi

  main_branch="$(get_main_branch)"
  log_info "Creating branch '${branch_name}' from '${main_branch}'..."
  git branch "${branch_name}" "${main_branch}"

  log_info "Creating worktree at ${worktree_path}..."
  git worktree add "${worktree_path}" "${branch_name}"

  log_info "Creating empty project structure in sdd/features/${feature_slug}/..."
  mkdir -p "${project_path}/product"/{discovery,product-ready}
  mkdir -p "${project_path}/design"/{spec-needed,designing,design-ready}
  mkdir -p "${project_path}/dev"/{backlog,spec-needed,spec-ready,implementing,blocked,review,rejected,testing,done,cancelled}

  cat > "${project_path}/README.md" <<EOF
# ${feature_slug}

Slug: \`${feature_slug}\`

## Context

Brief description of the business problem or opportunity.

## Scope

- Included functionality 1.
- Included functionality 2.

## Out of scope

- Future functionality 1.

## Milestones

1. MVP: ...
2. Iteration 2: ...

## Affected modules

- \`<path-to-module>/\` — create / modify
- \`<path-to-module>/\` — reuse (do not modify)

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Issues

- Product: \`sdd/features/${feature_slug}/product/\`
- Design: \`sdd/features/${feature_slug}/design/\`
- Dev: \`sdd/features/${feature_slug}/dev/\`
EOF

  (
    cd "${worktree_path}"
    git add "sdd/features/${feature_slug}/"
    git commit -m "chore(sdd): create project ${feature_slug}" || true
  )

  echo ""
  log_info "Worktree ready for feature '${feature_slug}'"
  echo "  Path:    ${worktree_path}"
  echo "  Branch:  ${branch_name}"
  echo "  Project: ${project_path}"
  echo ""
  log_info "Next step: prepare your environment (dependencies, environment variables, etc.) and start the spec."
  echo ""
}

cmd_remove() {
  local feature_slug="$1"
  local branch_name="feature/${feature_slug}"
  local worktree_path=""

  validate_feature_slug "${feature_slug}"
  ensure_repo_root

  worktree_path="$(worktree_path_for "${feature_slug}")"

  if [[ -d "${worktree_path}" ]]; then
    log_info "Removing worktree ${worktree_path}..."
    if git worktree remove "${worktree_path}" 2>/dev/null; then
      log_info "Worktree removed cleanly."
    else
      log_warn "Worktree has uncommitted changes or is locked. Forcing removal..."
      git worktree remove --force "${worktree_path}" || {
        log_warn "Could not remove with git worktree remove. Cleaning up manually..."
      }
    fi
  else
    log_warn "No worktree exists for '${feature_slug}'"
  fi

  git worktree prune 2>/dev/null || true

  if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    log_info "Removing local branch '${branch_name}'..."
    git branch -D "${branch_name}" 2>/dev/null || true
  fi

  if [[ -d "${worktree_path}" ]]; then
    rm -rf "${worktree_path}"
  fi

  log_info "Worktree and branch for '${feature_slug}' removed."
}

cmd_list() {
  ensure_repo_root

  echo "Active feature worktrees:"
  echo "─────────────────────────"

  local found=0
  local path=""
  local ref=""
  local feature_slug=""

  while IFS= read -r line; do
    path="$(echo "$line" | awk '{print $1}')"
    ref="$(echo "$line" | awk '{print $3}')"

    feature_slug=""
    if [[ "$path" == "${WORKTREE_BASE}/${REPO_NAME}-"* ]]; then
      feature_slug="${path#${WORKTREE_BASE}/${REPO_NAME}-}"
    fi

    if [[ -n "${feature_slug}" ]]; then
      echo "  📁 ${feature_slug}"
      echo "     Path:   ${path}"
      echo "     Branch: ${ref}"
      found=1
    fi
  done <<< "$(git worktree list 2>/dev/null || true)"

  if [[ "$found" -eq 0 ]]; then
    echo "  (none)"
  fi
}

cmd_status() {
  local feature_slug="$1"
  local worktree_path=""
  local dirty=""

  validate_feature_slug "${feature_slug}"
  ensure_repo_root

  worktree_path="$(worktree_path_for "${feature_slug}")"

  if [[ ! -d "${worktree_path}" ]]; then
    die "No worktree exists for '${feature_slug}'. Create it with: ./scripts/sdd-worktree.sh create ${feature_slug}"
  fi

  echo "Worktree '${feature_slug}' status:"
  echo "──────────────────────────────────"
  echo "Path:  ${worktree_path}"
  echo "Branch: $(cd "${worktree_path}" && git branch --show-current)"
  echo ""

  if ! (cd "${worktree_path}" && git diff --quiet && git diff --cached --quiet); then
    dirty=" (with uncommitted changes)"
  fi
  echo "Git:   ${dirty:-clean}"

  if [[ -x "${worktree_path}/init.sh" ]]; then
    echo ""
    echo "Running ./init.sh..."
    (
      cd "${worktree_path}"
      ./init.sh >/tmp/sdd-init-${feature_slug}.log 2>&1 && \
        log_info "init.sh passed" || \
        log_warn "init.sh failed — check /tmp/sdd-init-${feature_slug}.log"
    )
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────

show_help() {
  cat <<EOF
Usage: ./scripts/sdd-worktree.sh <command> <feature-slug>

Commands:
  create <feature-slug>   Create branch + worktree + SDD structure
  remove <feature-slug>   Remove worktree + branch
  list                    List active feature worktrees
  status <feature-slug>   Show status and run init.sh

Examples:
  ./scripts/sdd-worktree.sh create login-y-dashboard-layout
  ./scripts/sdd-worktree.sh status login-y-dashboard-layout
  ./scripts/sdd-worktree.sh remove login-y-dashboard-layout

Note:
  Worktrees are created as siblings of the main repo:
    ${WORKTREE_BASE}/${REPO_NAME}-<feature-slug>
  This script does not install dependencies or open a specific editor.
EOF
}

main() {
  local command="${1:-}"
  local feature_slug="${2:-}"

  case "${command}" in
    create)
      [[ -z "${feature_slug}" ]] && { show_help; exit 1; }
      cmd_create "${feature_slug}"
      ;;
    remove)
      [[ -z "${feature_slug}" ]] && { show_help; exit 1; }
      cmd_remove "${feature_slug}"
      ;;
    list)
      cmd_list
      ;;
    status)
      [[ -z "${feature_slug}" ]] && { show_help; exit 1; }
      cmd_status "${feature_slug}"
      ;;
    -h|--help|help)
      show_help
      ;;
    *)
      show_help
      exit 1
      ;;
  esac
}

main "$@"
```

### 5.2 `scripts/sdd-move.sh`

```bash
#!/usr/bin/env bash
#
# sdd-move.sh — Moves an SDD Issue between states and commits the change.
#
# Usage:
#   ./scripts/sdd-move.sh <feature-slug> <issue-name> <source-state> <target-state>
#
# Example:
#   ./scripts/sdd-move.sh login-y-dashboard-layout login design/spec-needed design/designing
#   ./scripts/sdd-move.sh login-y-dashboard-layout login dev/implementing dev/review

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

die() { log_error "$*"; exit 1; }

show_help() {
  cat <<EOF
Usage: ./scripts/sdd-move.sh <feature-slug> <issue> <source-state> <target-state>

Moves an Issue file between state folders in sdd/features/ and creates a commit.

Examples:
  ./scripts/sdd-move.sh login-y-dashboard-layout login design/spec-needed design/designing
  ./scripts/sdd-move.sh login-y-dashboard-layout login dev/implementing dev/review

Valid states for [Product]:
  product/discovery, product/product-ready

Valid states for [Design]:
  design/spec-needed, design/designing, design/design-ready

Valid states for [Dev]:
  dev/backlog, dev/spec-needed, dev/spec-ready, dev/implementing,
  dev/blocked, dev/review, dev/rejected, dev/testing, dev/done, dev/cancelled
EOF
}

validate_args() {
  if [ "$#" -ne 4 ]; then
    show_help
    exit 1
  fi
}

issue_type_for() {
  local state="$1"
  case "${state}" in
    product/discovery|product/product-ready)
      echo "[Product]"
      ;;
    design/spec-needed|design/designing|design/design-ready)
      echo "[Design]"
      ;;
    dev/backlog|dev/spec-needed|dev/spec-ready|dev/implementing|dev/blocked|dev/review|dev/rejected|dev/testing|dev/done|dev/cancelled)
      echo "[Dev]"
      ;;
    *)
      echo ""
      ;;
  esac
}

validate_state_transition() {
  local source_state="$1"
  local target_state="$2"
  local source_type=""
  local target_type=""

  source_type="$(issue_type_for "${source_state}")"
  target_type="$(issue_type_for "${target_state}")"

  if [[ -z "${source_type}" ]]; then
    die "Invalid source state: '${source_state}'. Valid states: product/<state>, design/<state> or dev/<state>."
  fi

  if [[ -z "${target_type}" ]]; then
    die "Invalid target state: '${target_state}'. Valid states: product/<state>, design/<state> or dev/<state>."
  fi

  if [[ "${source_type}" != "${target_type}" ]]; then
    die "Cannot move ${source_type} to ${target_type}. Keep the Issue type: product/* → product/*, design/* → design/* or dev/* → dev/*."
  fi
}

main() {
  local feature_slug="$1"
  local issue="$2"
  local source_state="$3"
  local target_state="$4"

  local project_path="${REPO_ROOT}/sdd/features/${feature_slug}"
  local source_file="${project_path}/${source_state}/${issue}.md"
  local target_file="${project_path}/${target_state}/${issue}.md"
  local issue_type=""
  local source_rel=""
  local target_rel=""
  local commit_msg=""

  validate_state_transition "${source_state}" "${target_state}"
  issue_type="$(issue_type_for "${source_state}")"

  if [ ! -f "${source_file}" ]; then
    die "File does not exist: ${source_file}"
  fi

  if [ -f "${target_file}" ]; then
    die "File already exists: ${target_file}"
  fi

  case "${target_state}" in
    design/spec-needed|design/designing|design/design-ready)
      if [ ! -f "${project_path}/product/product-ready/${issue}.md" ]; then
        log_warn "[Product] is not in product-ready/. Make sure the [Product] phase is approved before moving [Design] forward."
      fi
      ;;
    dev/backlog|dev/spec-needed|dev/spec-ready|dev/implementing|dev/blocked|dev/review|dev/rejected|dev/testing|dev/done)
      if [ ! -f "${project_path}/design/design-ready/${issue}.md" ]; then
        log_warn "[Design] is not in design-ready/. Make sure the [Design] phase is approved before moving [Dev] forward."
      fi
      ;;
  esac

  log_info "Moving ${issue} ${issue_type}: ${source_state} → ${target_state}"

  source_rel="${source_file#${REPO_ROOT}/}"
  target_rel="${target_file#${REPO_ROOT}/}"

  if git -C "${REPO_ROOT}" cat-file -e "HEAD:${source_rel}" >/dev/null 2>&1; then
    git -C "${REPO_ROOT}" mv "${source_rel}" "${target_rel}"
  else
    mkdir -p "$(dirname "${target_file}")"
    mv "${source_file}" "${target_file}"
    git -C "${REPO_ROOT}" rm --cached "${source_rel}" 2>/dev/null || true
    git -C "${REPO_ROOT}" add "${target_rel}"
  fi

  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s#^State: [\"\`].*[\"\`]#State: \"${target_state}\"#" "${target_file}" || true
  else
    sed -i "s#^State: [\"\`].*[\"\`]#State: \"${target_state}\"#" "${target_file}" || true
  fi

  git -C "${REPO_ROOT}" add "${target_file}"

  commit_msg="chore(sdd): ${issue} ${issue_type} ${source_state} → ${target_state}"
  if git -C "${REPO_ROOT}" diff --cached --quiet -- "${target_file}"; then
    log_warn "No changes to commit."
    exit 0
  fi
  git -C "${REPO_ROOT}" commit -m "${commit_msg}" -- "${target_file}" || {
    log_warn "Could not create the commit automatically. Do it manually."
    exit 1
  }

  log_info "Commit created: ${commit_msg}"
}

validate_args "$@"
main "$@"
```

### 5.3 `init.sh`

```bash
#!/usr/bin/env bash
# init.sh — SDD harness validation.
# Usage: ./init.sh
#
# This script verifies that the SDD structure and files are present.
# It does not run tests, lint, build, or validate stack tools.
# Each project can extend this script with its own checks.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

log_section() {
  echo ""
  echo "== $1 =="
}

ok() {
  echo -e "${GREEN}[OK]${NC} $1"
}

fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

count_md_files() {
  local dir="$1"
  if [[ ! -d "${dir}" ]]; then
    echo 0
    return
  fi
  find "${dir}" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' '
}

log_section "1. Harness files"

required_files=(
  "AGENTS.md"
  "CLAUDE.md"
  "init.sh"
  "sdd/README.md"
  "sdd/workflow.md"
  "sdd/architecture.md"
  "sdd/conventions.md"
  "sdd/quality-gates.md"
  "sdd/testing.md"
  "sdd/security.md"
  "sdd/delivery.md"
  ".claude/agents/orchestrator.md"
  ".claude/agents/product_manager.md"
  ".claude/agents/designer.md"
  ".claude/agents/tech_specifier.md"
  ".claude/agents/developer.md"
  ".claude/agents/auditor.md"
)

for f in "${required_files[@]}"; do
  if [ -f "$f" ]; then
    ok "$f"
  else
    fail "Missing $f"
  fi
done

log_section "2. Local SDD configuration"

if [ -d "sdd/features" ]; then
  ok "sdd/features/ exists"
else
  fail "Missing sdd/features/"
fi

if [ -d "sdd/decisions" ]; then
  ok "sdd/decisions/ exists"
else
  warn "Missing sdd/decisions/ — create with: mkdir -p sdd/decisions"
fi

ok "Legacy files not present (feature_list.yaml, specs/)"

log_section "3. SDD state validations"

PRODUCT_STATES=(discovery product-ready)
DESIGN_STATES=(spec-needed designing design-ready)
DEV_STATES=(backlog spec-needed spec-ready implementing blocked review rejected testing done cancelled)

state_is_valid() {
  local state="$1"
  local type="$2"
  local s=""

  if [[ "${type}" == "product" ]]; then
    for s in "${PRODUCT_STATES[@]}"; do
      if [[ "${s}" == "${state}" ]]; then
        return 0
      fi
    done
  elif [[ "${type}" == "design" ]]; then
    for s in "${DESIGN_STATES[@]}"; do
      if [[ "${s}" == "${state}" ]]; then
        return 0
      fi
    done
  elif [[ "${type}" == "dev" ]]; then
    for s in "${DEV_STATES[@]}"; do
      if [[ "${s}" == "${state}" ]]; then
        return 0
      fi
    done
  fi

  return 1
}

if [ -d "sdd/features" ]; then
  implementing_count=0
  review_count=0

  implementing_count=$(find sdd/features -mindepth 3 -maxdepth 3 -type d -name implementing -exec find {} -maxdepth 1 -type f -name '*.md' \; 2>/dev/null | wc -l | tr -d ' ')
  review_count=$(find sdd/features -mindepth 3 -maxdepth 3 -type d -name review -exec find {} -maxdepth 1 -type f -name '*.md' \; 2>/dev/null | wc -l | tr -d ' ')

  active_dev_count=$((implementing_count + review_count))

  if [[ "${active_dev_count}" -eq 0 ]]; then
    ok "No [Dev] Issues in implementing/ or review/"
  elif [[ "${active_dev_count}" -eq 1 ]]; then
    ok "Exactly one [Dev] Issue in implementing/ or review/"
  else
    fail "There are ${active_dev_count} [Dev] Issues in implementing/ or review/. There must be only one."
  fi
else
  warn "Cannot validate concurrency: sdd/features/ is missing"
fi

if [ -d "sdd/features" ]; then
  projects_found=0

  for project_dir in sdd/features/*/; do
    [[ -d "${project_dir}" ]] || continue
    projects_found=$((projects_found + 1))

    project_name="$(basename "${project_dir}")"
    product_count=0
    design_count=0
    dev_count=0

    if [ -d "${project_dir}/product" ]; then
      for state_dir in "${project_dir}/product"/*/; do
        [[ -d "${state_dir}" ]] || continue
        state_name="$(basename "${state_dir}")"
        if state_is_valid "${state_name}" product; then
          product_count=$((product_count + $(count_md_files "${state_dir}")))
        else
          fail "${project_name}/product/${state_name} is not a valid state for [Product]"
        fi
      done

      if [[ "$(count_md_files "${project_dir}/product")" -gt 0 ]]; then
        fail "${project_name}/product/ contains .md files outside a state folder"
      fi
    fi

    if [ -d "${project_dir}/design" ]; then
      for state_dir in "${project_dir}/design"/*/; do
        [[ -d "${state_dir}" ]] || continue
        state_name="$(basename "${state_dir}")"
        if state_is_valid "${state_name}" design; then
          design_count=$((design_count + $(count_md_files "${state_dir}")))
        else
          fail "${project_name}/design/${state_name} is not a valid state for [Design]"
        fi
      done

      if [[ "$(count_md_files "${project_dir}/design")" -gt 0 ]]; then
        fail "${project_name}/design/ contains .md files outside a state folder"
      fi
    fi

    if [ -d "${project_dir}/dev" ]; then
      for state_dir in "${project_dir}/dev"/*/; do
        [[ -d "${state_dir}" ]] || continue
        state_name="$(basename "${state_dir}")"
        if state_is_valid "${state_name}" dev; then
          dev_count=$((dev_count + $(count_md_files "${state_dir}")))
        else
          fail "${project_name}/dev/${state_name} is not a valid state for [Dev]"
        fi
      done

      if [[ "$(count_md_files "${project_dir}/dev")" -gt 0 ]]; then
        fail "${project_name}/dev/ contains .md files outside a state folder"
      fi
    fi

    if [[ "${product_count}" -eq 0 ]]; then
      fail "${project_name} has no [Product] Issue"
    else
      ok "${project_name}: has at least one [Product] Issue"
    fi

    if [[ "${design_count}" -eq 0 ]]; then
      fail "${project_name} has no [Design] Issue"
    else
      ok "${project_name}: has at least one [Design] Issue"
    fi

    if [[ "${dev_count}" -eq 0 ]]; then
      fail "${project_name} has no [Dev] Issue"
    else
      ok "${project_name}: has at least one [Dev] Issue"
    fi
  done

  if [[ "${projects_found}" -eq 0 ]]; then
    ok "sdd/features/ is empty — create a feature with: ./scripts/sdd-worktree.sh create <feature-slug>"
  fi
else
  warn "Cannot validate projects: sdd/features/ is missing"
fi

log_section "4. Additional project checks"

if [ -x "./scripts/project-checks.sh" ]; then
  echo "Running ./scripts/project-checks.sh..."
  if ./scripts/project-checks.sh; then
    ok "project-checks.sh passed"
  else
    fail "project-checks.sh failed"
  fi
else
  ok "Optional project checks skipped — create ./scripts/project-checks.sh to add stack validations"
fi

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}[OK] SDD harness ready${NC}"
  exit 0
else
  echo -e "${RED}[FAIL] SDD harness is not ready — $ERRORS error(s)${NC}"
  exit 1
fi
```

---

## 6. Templates

### 6.1 `sdd/templates/project.md`

```markdown
# <Feature slug>

Slug: `<feature-slug>`

## Context

Brief description of the business problem or opportunity.

## Scope

- Included functionality 1.
- Included functionality 2.

## Out of scope

- Future functionality 1.

## Milestones

1. MVP: ...
2. Iteration 2: ...

## Affected modules

- `<path-to-module-1>/` — create / modify
- `<path-to-module-2>/` — reuse (do not modify)

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Issues

- Design: `sdd/features/<feature-slug>/design/`
- Dev: `sdd/features/<feature-slug>/dev/`

## Decisions

- `sdd/decisions/<feature-slug>-<decision>.md`
```

### 6.2 `sdd/templates/issue-product.md`

```markdown
# [Product] <Issue title>

Project: `sdd/features/<feature-slug>/`
State: `<current-folder>`

## Context

Business problem, opportunity, and user context.

- **Target user**: who benefits.
- **Current problem**: what friction or need we solve.
- **Value hypothesis**: what changes if the feature succeeds.

## User Segments & Jobs-to-be-Done

| Segment | Main job | Usage context |
|---|---|---|
| Segment A | "I want ... so that ..." | When/where it happens |

## Product Goals

- Measurable objective 1.
- Measurable objective 2.

## Success Metrics

- **Metric 1**: definition, baseline (if any), target.
- **Metric 2**: definition, baseline (if any), target.

## Requirements

### R1: [short title]

WHEN ..., the system MUST ... (EARS notation).

### R2: [short title]

...

## Acceptance Criteria

- [ ] Criterion 1 verifiable from the product/business perspective.
- [ ] Criterion 2 verifiable.

## Out-of-Scope

- Functionality, scenario, or optimization that is **out** of this iteration.
- Deliberate decisions not to include to keep the MVP.

## BDD Scenarios

### Scenario: [descriptive name]

```gherkin
Given <initial context>
When <action>
Then <expected result>
```

### Scenario: [descriptive name]

...

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Dependencies

- blockedBy: —
- Blocks: `[Design] <issue-design>`

## Changelog

| Date | Author | Change | Reason |
|---|---|---|---|
| YYYY-MM-DD | Name | Brief description of the change | Why it was made |

> Record structural or scope changes during the issue lifecycle.

## Review

### Verdict: ✅ Approved / ❌ Rejected

### Findings
1. ...

### Action items (if rejected)
1. ...
```

### 6.3 `sdd/templates/issue-design.md`

```markdown
# [Design] <Issue title>

Project: `sdd/features/<feature-slug>/`
State: `<current-folder>`

## Context

Brief description of the problem or opportunity.

## Functional Spec

### Requirements

#### R1: [short title]

WHEN ..., the system MUST ... (EARS notation).

#### R2: [short title]

...

### Acceptance Criteria

- [ ] Verifiable criterion 1.
- [ ] Verifiable criterion 2.

### User Flows

```text
Screen/Action 1 → Screen/Action 2 → Final result
```

- **Main flow**: step-by-step happy path.
- **Alternative flows**: errors, cancellations, empty states.
- **Edge cases**: limits, permissions, unusual conditions.

### BDD Reference

- Approved [Product] issue: `sdd/features/<feature-slug>/product/product-ready/<issue-product>.md`
- Relevant scenarios for the design:
  - **Scenario**: [name] — `Given ... When ... Then ...`
  - **Scenario**: [name] — `Given ... When ... Then ...`

> The UI/UX design must be able to execute the BDD scenarios approved in [Product]. If a scenario is not visually supportable, document the limitation and notify the orchestrator.

## UI/UX Design

### Layout

- Screen structure, grid, breakpoints, spacing.

### Colors

- Palette, states (default, hover, active, disabled, error, success).

### Typography

- Scales, weights, and styles.

### Components

- Existing components to reuse, new components to create, variants.

### UI Flows

- Empty, loading, error, success, form states.

### Interactions

- Transitions, hover, focus, modals, drawers.

### Accessibility

- Contrast, keyboard navigation, ARIA.

### Design assets

- Tool: *(Figma, Pencil, Sketch, etc.)*
- File/Artboard: `<feature-slug>-<screen>`
- Relevant screenshots: [links or exports]

## Handoff to Dev

- **Components to create or extend**: list with required variants.
- **Existing components to reuse**: references to design system or code.
- **Key contracts**: input/output formats, shared states, events.
- **UI decisions pending validation**: anything that must be confirmed during implementation.
- **Implementation notes**: technical constraints observed from the design.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Dependencies

- Blocks: `[Dev] <issue-dev>`

## Changelog

| Date | Author | Change | Reason |
|---|---|---|---|
| YYYY-MM-DD | Name | Brief description of the change | Why it was made |

> Record structural or scope changes during the issue lifecycle.

## Review

### Verdict: ✅ Approved / ❌ Rejected

### Findings
1. ...

### Action items (if rejected)
1. ...
```

### 6.4 `sdd/templates/issue-dev.md`

```markdown
# [Dev] <Issue title>

Project: `sdd/features/<feature-slug>/`
State: `<current-folder>`

## Context

Implementation of [<feature>], based on the approved design in [Issue Design].

## Technical Decisions

### D1: [title]

- **Chosen**: [option]
- **Discarded alternatives**: [B], [C]
- **Reason**: [why]
- **Impact**: [affected modules]

### D2: ...

## Impact Analysis

| Module | Action | Exposed contract |
|---|---|---|
| `<path-to-module-1>/` | create / modify | ... |
| `<path-to-module-2>/` | reuse | — |

## Technical Notes

- Tables, APIs, libraries, considerations.

## Implementation Plan

1. Step 1.
2. Step 2.
3. Step 3.

## Test Plan

### Tests derived from R<n>

| Requirement | Acceptance test | Type | Priority |
|---|---|---|---|
| R1 | ... | unit / integration | required |
| R2 | ... | unit / integration | required |

### BDD Test Plan

Gherkin scenarios approved in [Product] converted into automated or manual acceptance tests.

| Scenario | Given / When / Then | Test type | Status |
|---|---|---|---|
| [name] | `Given ... When ... Then ...` | integration / e2e / manual | pending |
| [name] | `Given ... When ... Then ...` | integration / e2e / manual | pending |

- Reference [Product] issue: `sdd/features/<feature-slug>/product/product-ready/<issue-product>.md`

## Security Considerations

- [ ] RBAC: roles that can execute each action.
- [ ] Inputs sanitized and validated.
- [ ] No PII exposed.
- [ ] Audit trail on critical mutations.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Dependencies

- blockedBy: [Design] `<issue-design>`

## UI Reference

- Approved design: `sdd/features/<feature-slug>/design/design-ready/`
- Artboards: `<feature-slug>-<screen>`
- Screenshots: [links]

## Changelog

| Date | Author | Change | Reason |
|---|---|---|---|
| YYYY-MM-DD | Name | Brief description of the change | Why it was made |

> Record structural, technical, or scope changes during the issue lifecycle.

## Review

### Verdict: ✅ Approved / ❌ Rejected

### Findings
1. ...

### Traceability R<n> → Test
| Requirement | Test file | Line | Status |
|-----------|-----------|-------|--------|
| R1 | ... | ... | ✅ |

### Action items (if rejected)
1. ...
```

### 6.5 `sdd/templates/adr-template.md`

```markdown
# ADR-N: Short title of the decision

- **Status**: proposed / approved / deprecated / superseded by ADR-M
- **Date**: YYYY-MM-DD
- **Deciders**: @name-or-role

## Context

What problem are we solving? What forces or constraints are at play?

## Decision

The decision we made. It should be a clear statement.

## Consequences

### Positive

- ...
- ...

### Negative / trade-offs

- ...
- ...

## Discarded alternatives

| Alternative | Why it was not chosen |
|---|---|
| Option A | ... |
| Option B | ... |

## References

- Related issue: `sdd/features/<feature-slug>/`
- Relevant documents: `sdd/architecture.md`, `sdd/workflow.md`, etc.
```

---

## 7. Flujo de trabajo paso a paso

1. **Idea**: el humano describe la feature. El orchestrator crea el worktree.
2. **Product Discovery**: `sdd-product-manager` entrevista al humano y escribe el Issue `[Product]` en `product/discovery/`. Orchestrator lo mueve a `product/product-ready/`.
3. **Puerta humana 0**: el humano aprueba el spec de producto.
4. **Spec Design**: `sdd-designer` escribe el Issue `[Design]` en `design/spec-needed/`. Orchestrator lo mueve a `design/designing/`.
5. **Puerta humana 1**: el humano aprueba el spec funcional/UI.
6. **Design iteration**: diseño visual en la herramienta de diseño del proyecto.
7. **Puerta humana 2**: el humano aprueba el diseño visual. El Issue pasa a `design/design-ready/`.
8. **Spec Dev**: `sdd-tech-specifier` escribe el Issue `[Dev]` en `dev/spec-needed/`. Orchestrator lo mueve a `dev/spec-ready/`.
9. **Puerta humana 3**: el humano aprueba el spec técnico. El Issue pasa a `dev/implementing/`.
10. **Implementation**: `sdd-developer` ejecuta TDD por cada `R<n>` en el worktree.
11. **Review**: `sdd-auditor` audita contra C1–C7. Si aprueba, pasa a `dev/testing/`; si no, a `dev/rejected/`.
12. **Puerta humana 4**: el humano valida el merge. El orchestrator mergea, elimina el worktree y mueve el Issue a `dev/done/`.

---

## 8. Checklist C1–C7

Ver `sdd/quality-gates.md` para el detalle completo. Resumen:

| Gate | Qué verifica |
|---|---|
| **C1** | Harness completo: AGENTS.md, CLAUDE.md, init.sh, sdd/*.md, agentes, sdd/features/. |
| **C2** | Coherencia de estado: un solo `[Dev]` en implementing/review, estados válidos, proyectos completos. |
| **C3** | Cumplimiento arquitectónico: stack, convenciones, RBAC, no dead code, UI según diseño. |
| **C4** | Verificación real: tests, typecheck, lint, build, audit de dependencias, trazabilidad R<n> → test. |
| **C5** | Cierre limpio: init.sh verde, sin archivos huérfanos, worktree removido, README actualizado. |
| **C6** | Cumplimiento SDD: flujo completo Product → Design → Dev, puertas humanas respetadas. |
| **C7** | Seguridad: RBAC en tests, inputs validados, no PII loggeado, audit trail, secretos fuera del código. |

---

## 9. Integración en un fork de Kimi Code

### 9.1 Objetivo

Tener un **agente SDD nativo** dentro del fork de Kimi Code que:

- Se active con `kimi --agent-file .kimi/agents/sdd-orchestrator/agent.yaml` (o como agente por defecto en el fork).
- Tenga subagentes especializados (`sdd-product-manager`, `sdd-designer`, etc.).
- Mantenga la estructura `sdd/` como fuente de verdad.
- Reutilice los scripts `sdd-worktree.sh`, `sdd-move.sh` e `init.sh`.
- Respete las puertas humanas y el TDD.

### 9.2 Decisiones de diseño para el fork

1. **No reemplazar el agente default**: extenderlo con `extend: default` para conservar las capacidades base de Kimi Code.
2. **Subagentes nativos**: registrar los 5 roles SDD como subagentes en el `agent.yaml` del orchestrator.
3. **Prompts externalizados**: cada subagente tiene su propio `system.md`.
4. **Scripts bash reutilizables**: copiar `scripts/` e `init.sh` tal cual; funcionan en cualquier repo Git.
5. **Documentos SDD en markdown**: copiar `sdd/` completo al proyecto destino.
6. **Hooks de vida útil opcionales**: usar lifecycle hooks de Kimi Code para correr `init.sh` antes de declarar `done`.

---

## 10. Estructura propuesta en el fork

```text
<fork-kimi-code>/
├── apps/kimi-code/              # Código del CLI/TUI (existente)
├── packages/agent-core/         # Motor de agentes (existente)
├── .kimi/
│   └── agents/
│       ├── sdd-orchestrator/
│       │   ├── agent.yaml
│       │   └── system.md
│       ├── sdd-product-manager/
│       │   ├── agent.yaml
│       │   └── system.md
│       ├── sdd-designer/
│       │   ├── agent.yaml
│       │   └── system.md
│       ├── sdd-tech-specifier/
│       │   ├── agent.yaml
│       │   └── system.md
│       ├── sdd-developer/
│       │   ├── agent.yaml
│       │   └── system.md
│       └── sdd-auditor/
│           ├── agent.yaml
│           └── system.md
├── sdd/                         # Framework SDD (copiado de abel-sdd)
│   ├── README.md
│   ├── workflow.md
│   ├── architecture.md
│   ├── conventions.md
│   ├── quality-gates.md
│   ├── testing.md
│   ├── security.md
│   ├── delivery.md
│   ├── troubleshooting.md
│   ├── decisions/
│   ├── templates/
│   └── features/
├── scripts/
│   ├── sdd-worktree.sh
│   └── sdd-move.sh
├── AGENTS.md                    # Mapa SDD para agentes
├── CLAUDE.md                    # Prompt rápido del orchestrator
├── init.sh                      # Verificación del harness
└── README.md                    # Documentación del fork
```

> Si el fork de Kimi Code es un monorepo, el SDD puede vivir en la raíz y las features pueden cruzar paquetes.

---

## 11. Pasos de instalación en el fork

### 11.1 Copiar el framework SDD

```bash
# Desde el repo abel-sdd
./install.sh /ruta/al/fork-de-kimi-code
```

O manualmente:

```bash
cp -R sdd scripts AGENTS.md CLAUDE.md init.sh /ruta/al/fork-de-kimi-code/
chmod +x /ruta/al/fork-de-kimi-code/init.sh
chmod +x /ruta/al/fork-de-kimi-code/scripts/*.sh
```

### 11.2 Crear los agentes nativos de Kimi Code

Crear la carpeta `.kimi/agents/` en el fork y, para cada rol, un archivo `agent.yaml` y un `system.md` con los prompts de la sección [Roles](#4-roles-y-prompts-de-agentes).

Ejemplo para `sdd-product-manager/agent.yaml`:

```yaml
version: 1
agent:
  name: sdd-product-manager
  extend: default
  system_prompt_path: ./system.md
  tools:
    - "kimi_code.tools.shell:Shell"
    - "kimi_code.tools.file:ReadFile"
    - "kimi_code.tools.file:WriteFile"
    - "kimi_code.tools.file:Glob"
    - "kimi_code.tools.file:Grep"
    - "kimi_code.tools.question:AskUserQuestion"
```

> Reemplaza `kimi_code.tools.*` por los import paths reales del fork.

### 11.3 Configurar el agente por defecto (opcional)

Para que `kimi` arranque directamente como SDD orchestrator, modificar la configuración del fork o crear un wrapper:

```bash
kimi --agent-file .kimi/agents/sdd-orchestrator/agent.yaml
```

O añadir un alias:

```bash
alias kimi-sdd='kimi --agent-file .kimi/agents/sdd-orchestrator/agent.yaml'
```

### 11.4 Verificar el harness

```bash
cd /ruta/al/fork-de-kimi-code
./init.sh
```

Debe imprimir `[OK] SDD harness ready`.

### 11.5 Crear la primera feature

```bash
./scripts/sdd-worktree.sh create mi-primera-feature
```

---

## 12. Próximos pasos recomendados

1. **Fork de kimi-code**: crear el fork y clonarlo localmente.
2. **Instalar SDD**: copiar `sdd/`, `scripts/`, `AGENTS.md`, `CLAUDE.md` e `init.sh`.
3. **Adaptar agentes YAML**: convertir los prompts de este documento en archivos `agent.yaml` + `system.md` dentro de `.kimi/agents/`.
4. **Mapear tools**: asegurar que los tool paths en los YAML coincidan con los de Kimi Code (`kimi_code.tools.shell:Shell`, etc.).
5. **Añadir lifecycle hook**: configurar un hook previo a declarar `done` que ejecute `./init.sh`.
6. **Probar el flujo end-to-end**: crear una feature de prueba y pasar por todos los estados.
7. **Documentar decisiones**: escribir ADRs en `sdd/decisions/` para cada adaptación arquitectónica al fork.
8. **Publicar**: si se desea, convertir el fork en un template o skill para Kimi Code.

---

## Apéndice: archivos a copiar desde abel-sdd

```text
AGENTS.md
CLAUDE.md
init.sh
install.sh
sdd-cli
sdd/README.md
sdd/workflow.md
sdd/architecture.md
sdd/conventions.md
sdd/quality-gates.md
sdd/testing.md
sdd/security.md
sdd/delivery.md
sdd/troubleshooting.md
sdd/decisions/
sdd/templates/
sdd/features/          # opcional: solo como ejemplo
scripts/sdd-worktree.sh
scripts/sdd-move.sh
.claude/agents/orchestrator.md
.claude/agents/product_manager.md
.claude/agents/designer.md
.claude/agents/tech_specifier.md
.claude/agents/developer.md
.claude/agents/auditor.md
```

> Nota: los archivos `.claude/agents/*.md` son la fuente de los prompts de la sección 4. En Kimi Code se convertirán en `.kimi/agents/<rol>/system.md`.
