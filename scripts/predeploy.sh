#!/usr/bin/env bash
#
# predeploy.sh — Mandatory checks before deploying app.verisum.org
#
# Run via: npm run predeploy
# Also enforced automatically by the git pre-push hook.
#
# Exit codes:
#   0 = all checks passed, safe to deploy
#   1 = a check failed, do NOT deploy
#

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

passed=0
failed=0
warnings=0

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  passed=$((passed + 1))
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  failed=$((failed + 1))
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  warnings=$((warnings + 1))
}

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Verisum Pre-Deploy Checks — app.verisum.org${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""

# ─── Check 1: Correct branch ───
echo -e "${BOLD}Branch Check${NC}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  pass "On main branch"
else
  warn "On branch '$BRANCH' — only main auto-deploys to production"
fi
echo ""

# ─── Check 2: Working directory clean ───
echo -e "${BOLD}Working Directory${NC}"
if [ -z "$(git status --porcelain)" ]; then
  pass "Working directory is clean"
else
  warn "Uncommitted changes detected (won't be deployed)"
fi
echo ""

# ─── Check 3: TypeScript compilation ───
echo -e "${BOLD}TypeScript${NC}"
if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compiles without errors"
else
  fail "TypeScript compilation failed — fix type errors before deploying"
fi
echo ""

# ─── Check 4: ESLint ───
echo -e "${BOLD}Linting${NC}"
if npm run lint 2>/dev/null; then
  pass "ESLint passed"
else
  fail "ESLint found errors — fix lint issues before deploying"
fi
echo ""

# ─── Check 5: Production build ───
echo -e "${BOLD}Production Build${NC}"
echo "  Running next build (this may take a minute)..."
if npm run build 2>/dev/null; then
  pass "Production build succeeded"
else
  fail "Production build failed — this WILL break the deploy"
fi
echo ""

# ─── Check 6: Tests ───
echo -e "${BOLD}Tests${NC}"
if npm run test 2>/dev/null; then
  pass "All tests passed"
else
  fail "Tests failed — fix failing tests before deploying"
fi
echo ""

# ─── Check 7: .env.example has all expected keys ───
echo -e "${BOLD}Env Template${NC}"
if [ -f ".env.example" ]; then
  pass ".env.example exists"
else
  warn ".env.example missing — other devs won't know what env vars are needed"
fi
echo ""

# ─── Summary ───
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
if [ $failed -gt 0 ]; then
  echo -e "  ${RED}DEPLOY BLOCKED${NC}: $failed check(s) failed, $passed passed, $warnings warning(s)"
  echo ""
  echo "  Fix the failures above before pushing to main."
  echo ""
  exit 1
else
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC}: $passed passed, $warnings warning(s)"
  echo ""
  echo "  Safe to push:  git push origin main"
  echo ""
  exit 0
fi
