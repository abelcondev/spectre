#!/usr/bin/env bash
set -euo pipefail

REPO="abelcondev/spectre"
INSTALL_DIR="${SPECTRE_INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${SPECTRE_VERSION:-latest}"

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

verify_checksum() {
  local file=$1
  local checksum_file=$2
  local dir
  dir=$(dirname "$file")

  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$dir" && sha256sum -c "$(basename "$checksum_file")")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$dir" && shasum -a 256 -c "$(basename "$checksum_file")")
  else
    echo "warning: neither sha256sum nor shasum found; skipping checksum verification" >&2
  fi
}

main() {
  local target zip url checksum_url
  target=$(detect_target)
  zip="spectre-${target}.zip"

  if [ "$VERSION" = "latest" ]; then
    url="https://github.com/${REPO}/releases/latest/download/${zip}"
  else
    url="https://github.com/${REPO}/releases/download/${VERSION}/${zip}"
  fi
  checksum_url="${url}.sha256"

  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  echo "Downloading ${zip} ..."
  curl -fsSL -o "${tmpdir}/${zip}" "${url}"
  curl -fsSL -o "${tmpdir}/${zip}.sha256" "${checksum_url}"

  echo "Verifying checksum ..."
  verify_checksum "${tmpdir}/${zip}" "${tmpdir}/${zip}.sha256"

  mkdir -p "$INSTALL_DIR"
  unzip -o "${tmpdir}/${zip}" -d "$INSTALL_DIR"
  chmod +x "${INSTALL_DIR}/spectre"

  echo ""
  echo "Spectre installed to ${INSTALL_DIR}/spectre"
  if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
    echo "Add ${INSTALL_DIR} to your PATH to use the 'spectre' command."
  fi
}

main "$@"
