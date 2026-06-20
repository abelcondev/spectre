#!/usr/bin/env bash
set -euo pipefail

REPO="abelcondev/spectre"
INSTALL_DIR="${SPECTRE_INSTALL_DIR:-$HOME/.local/bin}"

detect_target() {
  local os arch
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)

  case "$os" in
    darwin) os="darwin" ;;
    linux) os="linux" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

main() {
  local target zip url checksum_url tmpdir
  target=$(detect_target)
  zip="spectre-${target}.zip"
  url="https://github.com/${REPO}/releases/latest/download/${zip}"
  checksum_url="${url}.sha256"

  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  echo "Downloading ${zip} ..."
  curl -fsSL -o "${tmpdir}/${zip}" "${url}"
  curl -fsSL -o "${tmpdir}/${zip}.sha256" "${checksum_url}"

  echo "Verifying checksum ..."
  (
    cd "$tmpdir"
    shasum -a 256 -c "${zip}.sha256"
  )

  mkdir -p "$INSTALL_DIR"
  unzip -o "${tmpdir}/${zip}" -d "$INSTALL_DIR"
  chmod +x "${INSTALL_DIR}/spectre"

  echo ""
  echo "Specter installed to ${INSTALL_DIR}/spectre"
  if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
    echo "Add ${INSTALL_DIR} to your PATH to use the 'spectre' command."
  fi
}

main "$@"
