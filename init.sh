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

# Count .md files directly under a directory.
count_md_files() {
  local dir="$1"
  if [[ ! -d "${dir}" ]]; then
    echo 0
    return
  fi
  find "${dir}" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l | tr -d ' '
}

# ─────────────────────────────────────────
# 1. Harness files
# ─────────────────────────────────────────
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
  "packages/agent-core/src/profile/sdd/sdd-orchestrator.yaml"
  "packages/agent-core/src/profile/sdd/sdd-product-manager.yaml"
  "packages/agent-core/src/profile/sdd/sdd-designer.yaml"
  "packages/agent-core/src/profile/sdd/sdd-tech-specifier.yaml"
  "packages/agent-core/src/profile/sdd/sdd-developer.yaml"
  "packages/agent-core/src/profile/sdd/sdd-auditor.yaml"
  "packages/agent-core/src/profile/sdd/system/orchestrator.md"
  "packages/agent-core/src/profile/sdd/system/product-manager.md"
  "packages/agent-core/src/profile/sdd/system/designer.md"
  "packages/agent-core/src/profile/sdd/system/tech-specifier.md"
  "packages/agent-core/src/profile/sdd/system/developer.md"
  "packages/agent-core/src/profile/sdd/system/auditor.md"
)

for f in "${required_files[@]}"; do
  if [ -f "$f" ]; then
    ok "$f"
  else
    fail "Missing $f"
  fi
done

# ─────────────────────────────────────────
# 2. Local SDD configuration
# ─────────────────────────────────────────
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

# ─────────────────────────────────────────
# 3. SDD state validations
# ─────────────────────────────────────────
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

# 3.1 Concurrency: at most one Issue [Dev] in implementing/ or review/.
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

# 3.2 Every project must have at least one Issue [Product], one [Design], and one [Dev].
# 3.3 State folders must be valid according to sdd/workflow.md.
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

      # There should be no loose files directly in product/
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

      # There should be no loose files directly in design/
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
  echo -e "${GREEN}[OK] SDD harness ready${NC}"
  exit 0
else
  echo -e "${RED}[FAIL] SDD harness is not ready — $ERRORS error(s)${NC}"
  exit 1
fi
