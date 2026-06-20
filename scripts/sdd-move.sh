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

  # Warnings for phase gates (non-blocking).
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

  # git mv only works well if the file is already committed.
  # If it is new (only staged or untracked), do a manual mv + git add.
  if git -C "${REPO_ROOT}" cat-file -e "HEAD:${source_rel}" >/dev/null 2>&1; then
    git -C "${REPO_ROOT}" mv "${source_rel}" "${target_rel}"
  else
    mkdir -p "$(dirname "${target_file}")"
    mv "${source_file}" "${target_file}"
    git -C "${REPO_ROOT}" rm --cached "${source_rel}" 2>/dev/null || true
    git -C "${REPO_ROOT}" add "${target_rel}"
  fi

  # Update the State line inside the file.
  # Supports both double quotes and backticks in the templates.
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s#^State: [\"\`].*[\"\`]#State: \"${target_state}\"#" "${target_file}" || true
  else
    sed -i "s#^State: [\"\`].*[\"\`]#State: \"${target_state}\"#" "${target_file}" || true
  fi

  git -C "${REPO_ROOT}" add "${target_file}"

  # Commit only this issue change, not other staged files.
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
