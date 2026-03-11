const INSTALL_SCRIPT = `#!/bin/sh
set -eu

REPO_URL="\${CONTEXT9_REPO_URL:-https://github.com/Mini256/context9.git}"
INSTALL_ROOT="\${CONTEXT9_INSTALL_ROOT:-$HOME/.local/share/context9}"
BIN_DIR="\${CONTEXT9_BIN_DIR:-$HOME/.local/bin}"
REPO_DIR="$INSTALL_ROOT/repo"
TMP_DIR="$INSTALL_ROOT/repo.tmp"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "context9 install error: missing required command '$1'" >&2
    exit 1
  fi
}

require_command git
require_command node

mkdir -p "$INSTALL_ROOT" "$BIN_DIR"
rm -rf "$TMP_DIR"

git clone --depth=1 "$REPO_URL" "$TMP_DIR"
cd "$TMP_DIR"

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.15.0 --activate >/dev/null 2>&1 || true
fi

require_command pnpm

pnpm install --frozen-lockfile
pnpm --filter @context9/cli build

rm -rf "$REPO_DIR"
mv "$TMP_DIR" "$REPO_DIR"

cat > "$BIN_DIR/context9" <<'EOF'
#!/bin/sh
exec node "$HOME/.local/share/context9/repo/packages/cli/dist/cli.js" "$@"
EOF

chmod +x "$BIN_DIR/context9"

echo ""
echo "context9 installed to $BIN_DIR/context9"
echo ""
echo "If '$BIN_DIR' is not in your PATH, add this line to your shell profile:"
echo "  export PATH=\\"$BIN_DIR:\\$PATH\\""
echo ""
echo "Then run:"
echo "  context9"
`;

export async function GET() {
  return new Response(INSTALL_SCRIPT, {
    headers: {
      "content-type": "text/x-shellscript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
