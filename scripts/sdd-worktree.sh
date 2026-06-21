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

# ─── Package manager detection ────────────────────────────────────────

detect_package_manager() {
  local dir="$1"
  if [[ -f "${dir}/pnpm-lock.yaml" ]] || [[ -f "${dir}/pnpm-workspace.yaml" ]]; then
    echo "pnpm"
    return
  fi
  if [[ -f "${dir}/bun.lockb" ]] || [[ -f "${dir}/bun.lock" ]]; then
    echo "bun"
    return
  fi
  if [[ -f "${dir}/yarn.lock" ]]; then
    echo "yarn"
    return
  fi
  if [[ -f "${dir}/package-lock.json" ]]; then
    echo "npm"
    return
  fi
  if [[ -f "${dir}/package.json" ]]; then
    local pm=""
    pm="$(node -e "console.log((require('${dir}/package.json').packageManager || '').split('@')[0])" 2>/dev/null || true)"
    if [[ -n "${pm}" ]]; then
      echo "${pm}"
      return
    fi
    echo "npm"
    return
  fi
  echo ""
}

install_dependencies() {
  local dir="$1"
  local pm=""
  pm="$(detect_package_manager "${dir}")"
  if [[ -z "${pm}" ]]; then
    log_info "No package.json found; skipping dependency install."
    return 0
  fi

  if ! command -v "${pm}" >/dev/null 2>&1; then
    log_warn "Detected package manager '${pm}' is not installed; skipping dependency install."
    return 0
  fi

  log_info "Installing dependencies with ${pm}..."
  if (cd "${dir}" && "${pm}" install); then
    log_info "Dependencies installed."
  else
    log_warn "Dependency install failed. Run '${pm} install' manually in ${dir}."
  fi
}

ensure_clean_main() {
  local current_branch=""
  current_branch="$(git branch --show-current 2>/dev/null || true)"

  if [[ "${current_branch}" != "main" && "${current_branch}" != "master" ]]; then
    die "You are on branch '${current_branch}'. Feature worktrees must be created from a clean main (or master) branch."
  fi

  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    die "The repository has uncommitted changes. Commit or stash them before creating a feature worktree so the worktree inherits a clean copy of main."
  fi
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
  ensure_clean_main

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

  install_dependencies "${worktree_path}"

  echo ""
  log_info "Worktree ready for feature '${feature_slug}'"
  echo "  Path:    ${worktree_path}"
  echo "  Branch:  ${branch_name}"
  echo "  Project: ${project_path}"
  echo ""
  log_info "Next step: prepare your environment (environment variables, etc.) and start the spec."
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

  # Make sure git does not keep references to the worktree
  git worktree prune 2>/dev/null || true

  if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
    log_info "Removing local branch '${branch_name}'..."
    git branch -D "${branch_name}" 2>/dev/null || true
  fi

  # Clean residual directory if it remains
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
