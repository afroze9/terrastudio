#!/usr/bin/env sh
# Install tstudio CLI — TerraStudio headless CLI
# Usage: curl -fsSL https://raw.githubusercontent.com/afroze9/terrastudio/master/scripts/install.sh | sh
# npm: npm install -g @afroze9/terrastudio-cli
set -e

REPO="afroze9/terrastudio"
BINARY="tstudio"
INSTALL_DIR="${TSTUDIO_INSTALL_DIR:-/usr/local/bin}"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    case "$ARCH" in
      x86_64) TARGET="linux-x64" ;;
      *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  Darwin)
    case "$ARCH" in
      arm64)  TARGET="macos-arm64" ;;
      x86_64) TARGET="macos-x64" ;;
      *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  *)
    echo "Unsupported OS: $OS"
    echo "For Windows, run: irm https://raw.githubusercontent.com/afroze9/terrastudio/master/scripts/install.ps1 | iex"
    exit 1
    ;;
esac

# Get latest release version from GitHub API
echo "Fetching latest tstudio release..."
VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"apps\/desktop-v\([^"]*\)".*/\1/')"

if [ -z "$VERSION" ]; then
  echo "Failed to fetch latest version. Check your internet connection."
  exit 1
fi

echo "Installing tstudio v${VERSION} (${TARGET})..."

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/apps/desktop-v${VERSION}/tstudio-${VERSION}-${TARGET}"
TMP="$(mktemp)"

curl -fsSL "$DOWNLOAD_URL" -o "$TMP"
chmod +x "$TMP"

# Install — try without sudo first, fall back with sudo
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "${INSTALL_DIR}/${BINARY}"
else
  echo "Installing to ${INSTALL_DIR} (requires sudo)..."
  sudo mv "$TMP" "${INSTALL_DIR}/${BINARY}"
fi

echo ""
echo "tstudio v${VERSION} installed to ${INSTALL_DIR}/${BINARY}"
echo "Run: tstudio --help"
