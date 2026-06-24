#!/usr/bin/env bash
# init.sh — Spectre harness validation.
# Usage: ./init.sh
#
# This script verifies that the Spectre SDD framework is present and
# that the embedded assets are up to date. Spectre itself does not use
# SDD for its own development; the framework is only a set of templates
# copied into other projects.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

FRAMEWORK_DIR="packages/agent-core/src/tools/builtin/sdd/framework"

# ─────────────────────────────────────────
# 1. Framework files
# ─────────────────────────────────────────
log_section "1. SDD framework files"

required_files=(
  "${FRAMEWORK_DIR}/AGENTS.md"
  "${FRAMEWORK_DIR}/README.md"
  "${FRAMEWORK_DIR}/workflow.md"
  "${FRAMEWORK_DIR}/architecture.md"
  "${FRAMEWORK_DIR}/conventions.md"
  "${FRAMEWORK_DIR}/quality-gates.md"
  "${FRAMEWORK_DIR}/testing.md"
  "${FRAMEWORK_DIR}/security.md"
  "${FRAMEWORK_DIR}/delivery.md"
  "${FRAMEWORK_DIR}/tech-stack.md"
  "${FRAMEWORK_DIR}/product.md"
  "${FRAMEWORK_DIR}/troubleshooting.md"
  "${FRAMEWORK_DIR}/init-project.sh"
  "${FRAMEWORK_DIR}/templates/issue-product.md"
  "${FRAMEWORK_DIR}/templates/issue-design.md"
  "${FRAMEWORK_DIR}/templates/issue-dev.md"
  "${FRAMEWORK_DIR}/templates/design-system-spec.md"
)

for f in "${required_files[@]}"; do
  if [ -f "$f" ]; then
    ok "$f"
  else
    fail "Missing $f"
  fi
done

# ─────────────────────────────────────────
# 2. SDD assets up to date
# ─────────────────────────────────────────
log_section "2. SDD assets up to date"

if node scripts/generate-sdd-assets.mjs >/dev/null 2>&1; then
  if git diff --quiet packages/agent-core/src/tools/builtin/sdd/sdd-assets.ts 2>/dev/null; then
    ok "sdd-assets.ts is up to date"
  else
    warn "sdd-assets.ts was regenerated and differs from the committed version. Commit the updated file."
  fi
else
  fail "scripts/generate-sdd-assets.mjs failed"
fi

# ─────────────────────────────────────────
# 3. Agent profiles
# ─────────────────────────────────────────
log_section "3. Agent profiles"

profile_files=(
  "packages/agent-core/src/profile/default/system.md"
  "packages/agent-core/src/profile/sdd/sdd-product-manager.yaml"
  "packages/agent-core/src/profile/sdd/sdd-tech-lead.yaml"
  "packages/agent-core/src/profile/sdd/sdd-designer.yaml"
  "packages/agent-core/src/profile/sdd/sdd-tech-specifier.yaml"
  "packages/agent-core/src/profile/sdd/sdd-developer.yaml"
  "packages/agent-core/src/profile/sdd/sdd-auditor.yaml"
  "packages/agent-core/src/profile/sdd/system/product-manager.md"
  "packages/agent-core/src/profile/sdd/system/tech-lead.md"
  "packages/agent-core/src/profile/sdd/system/designer.md"
  "packages/agent-core/src/profile/sdd/system/tech-specifier.md"
  "packages/agent-core/src/profile/sdd/system/developer.md"
  "packages/agent-core/src/profile/sdd/system/auditor.md"
)

for f in "${profile_files[@]}"; do
  if [ -f "$f" ]; then
    ok "$f"
  else
    fail "Missing $f"
  fi
done

# ─────────────────────────────────────────
# 4. Additional project checks (optional)
# ─────────────────────────────────────────
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

# ─────────────────────────────────────────
# Summary
# ─────────────────────────────────────────
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}[OK] Spectre harness ready${NC}"
  exit 0
else
  echo -e "${RED}[FAIL] Spectre harness is not ready — $ERRORS error(s)${NC}"
  exit 1
fi
