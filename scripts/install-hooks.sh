#!/usr/bin/env bash
#
# install-hooks.sh — Installs git hooks for Verisum
# Called automatically via `npm install` (package.json "prepare" script)
#

HOOK_DIR=".git/hooks"

if [ ! -d "$HOOK_DIR" ]; then
  echo "No .git directory found — skipping hook installation"
  exit 0
fi

# ─── Pre-push hook ───
# Runs predeploy checks when pushing to main
cat > "$HOOK_DIR/pre-push" << 'HOOK'
#!/usr/bin/env bash
#
# pre-push hook — blocks pushes to main if predeploy checks fail
#

# Only gate pushes to main
while read local_ref local_sha remote_ref remote_sha; do
  if echo "$remote_ref" | grep -q "refs/heads/main"; then
    echo ""
    echo "Pushing to main triggers a production deploy."
    echo "Running pre-deploy checks..."
    echo ""

    if ! bash scripts/predeploy.sh; then
      echo ""
      echo "Push to main BLOCKED — fix the issues above first."
      exit 1
    fi
  fi
done

exit 0
HOOK

chmod +x "$HOOK_DIR/pre-push"
echo "Git hooks installed: pre-push (blocks main pushes without passing checks)"
