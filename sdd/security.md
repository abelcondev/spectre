# Security — Security in SDD

Security is not an extra step: it is a dimension reviewed in every feature.

---

## 1. Principles

1. **Least privilege**: a role only accesses what it needs.
2. **Defense in depth**: validate on client, server, and database.
3. **Sensitive by default**: assume any data may be sensitive until proven otherwise.
4. **No hard deletes**: business entities use terminal states (`cancelled`, `voided`, `inactive`).
5. **Audit trail**: every critical mutation records who, when, and what changed.

---

## 2. Security Checklist per Feature

Every `[Dev]` Issue must consider these items. If applicable, it must be documented in the technical spec.

### Auth and Permissions

- [ ] Does the route or function verify authentication?
- [ ] Is the user's role validated before executing the action?
- [ ] Can a user view/modify another user's data?
- [ ] Do critical actions require an explicit role (not "any logged-in user")?

### Data

- [ ] Are user inputs sanitized?
- [ ] Are types and ranges validated on the server/edge?
- [ ] Is PII not logged (identity documents, payment data, emails, phones)?
- [ ] Do errors not leak internal information (stack traces, DB IDs)?

### Dependencies

- [ ] Was the dependency audit run before merging?
- [ ] Are new dependencies necessary and maintained?
- [ ] Are no duplicate functionality libraries added?

### Infrastructure

- [ ] Do secrets live only in environment variables and never in code?
- [ ] Is the worktree environment file not committed?
- [ ] Are there no exposed endpoints without authorization?

---

## 3. Security Gates by Risk

### Critical Features

Features that touch **payments, auth, personal data, or financial operations** have additional gates:

- 100% test coverage on critical flows.
- Explicit security review in the checklist.
- Mandatory audit trail.
- Not merged without additional human approval.

### Standard Features

- Security checklist completed in the technical spec.
- Dependency audit without critical vulnerabilities.
- RBAC verified in integration tests.

---

## 4. PII and Sensitive Data

### What Is Considered PII

- Full names.
- Identity documents / passports.
- Payment data (cards, accounts).
- Emails and phones (in contexts that allow identification).
- Any other data the project defines as sensitive.

### Rules

- Do not log PII in console or third-party services.
- Do not expose PII in URLs or API responses without need.
- Implement logical deletion, not physical, unless there is explicit legal requirement.
- Respect rights of access, rectification, and cancellation.

---

## 5. RBAC

Each project defines its roles in `sdd/architecture.md`. Each feature must document:

```markdown
## Permissions

| Action | Admin | Operator | Viewer |
|---|---|---|---|
| Create resource | ✅ | ✅ | ❌ |
| View all resources | ✅ | ❌ | ❌ |
| View my resources | ✅ | ✅ | ✅ |
```

And each integration test must validate at least one denied access case.

---

## 6. Dependencies and Vulnerabilities

### Before Adding a Dependency

1. Justify it in a `D<n>` of the technical spec.
2. Verify it does not duplicate existing functionality.
3. Review last release date, open issues, and license.

### Before Merging

```bash
<dependency-audit>
```

> The project completes with its package manager.

If there are critical vulnerabilities, they are resolved before merge. If they cannot be resolved, document them in the `## Risks` section of the `[Dev]` Issue.

---

## 7. Secrets and Environments

- The environment file is copied/manualized when creating a worktree.
- The real environment file is never committed (must be in `.gitignore`).
- Do not hardcode API keys, tokens, or credentials.
- For tests, use fixture values instead of real secrets.

---

## 8. Regulatory Compliance

The project must adapt this section to the regulations that apply to it (e.g. GDPR, the data protection law of the country of operation, etc.).

General principles:

- Explicit consent for personal data.
- Right of access, rectification, and cancellation.
- Logical deletion, not physical.
- Processing record aligned with the audit trail.

---

## 9. Incident Reporting

If a vulnerability or data breach is discovered during a feature:

1. Stop the `[Dev]` Issue's progress and move it to `dev/blocked/`.
2. Document the incident in the `## Risks` section of the Issue.
3. Notify the human before continuing.
4. Do not merge until the risk is mitigated.

---

## 10. Final Security Checklist (C7)

The `auditor` verifies these items before approving a critical feature:

- [ ] RBAC validated in tests.
- [ ] Inputs sanitized and validated.
- [ ] No PII logged.
- [ ] Audit trail present on critical mutations.
- [ ] Dependency audit without critical vulnerabilities.
- [ ] No hard deletes on business entities.
- [ ] Secrets outside the codebase.
