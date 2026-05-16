#!/bin/bash
# ==============================================================================
# BeRight Protocol - Security Hooks Installer
# ==============================================================================
# This script installs pre-commit hooks to prevent secrets from being committed.
#
# Usage: ./scripts/install-hooks.sh
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "BeRight Security Hooks Installer"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/.pre-commit-config.yaml" ]; then
    echo -e "${RED}Error: .pre-commit-config.yaml not found in project root${NC}"
    echo "Please run this script from the beright project directory"
    exit 1
fi

cd "$PROJECT_ROOT"

# ==============================================================================
# INSTALL PRE-COMMIT
# ==============================================================================

echo "1. Checking for pre-commit..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo -e "${YELLOW}pre-commit not found. Installing...${NC}"
    
    # Try different installation methods
    if command -v pip3 &> /dev/null; then
        pip3 install pre-commit
    elif command -v pip &> /dev/null; then
        pip install pre-commit
    elif command -v brew &> /dev/null; then
        brew install pre-commit
    else
        echo -e "${RED}Error: Cannot install pre-commit.${NC}"
        echo "Please install manually: pip install pre-commit"
        echo "Or: brew install pre-commit"
        exit 1
    fi
    
    echo -e "${GREEN}pre-commit installed successfully${NC}"
else
    echo -e "${GREEN}pre-commit already installed${NC}"
fi

# ==============================================================================
# INSTALL GITLEAKS
# ==============================================================================

echo ""
echo "2. Checking for gitleaks..."

if ! command -v gitleaks &> /dev/null; then
    echo -e "${YELLOW}gitleaks not found. Installing...${NC}"
    
    if command -v brew &> /dev/null; then
        brew install gitleaks
    elif command -v go &> /dev/null; then
        go install github.com/gitleaks/gitleaks/v8@latest
    else
        echo -e "${YELLOW}Warning: Cannot auto-install gitleaks.${NC}"
        echo "Please install manually:"
        echo "  macOS: brew install gitleaks"
        echo "  Go: go install github.com/gitleaks/gitleaks/v8@latest"
        echo ""
        echo "Continuing without gitleaks (pre-commit will still work)..."
    fi
else
    echo -e "${GREEN}gitleaks already installed${NC}"
fi

# ==============================================================================
# INSTALL DETECT-SECRETS
# ==============================================================================

echo ""
echo "3. Checking for detect-secrets..."

if ! command -v detect-secrets &> /dev/null; then
    echo -e "${YELLOW}detect-secrets not found. Installing...${NC}"
    pip3 install detect-secrets || pip install detect-secrets
    echo -e "${GREEN}detect-secrets installed successfully${NC}"
else
    echo -e "${GREEN}detect-secrets already installed${NC}"
fi

# ==============================================================================
# GENERATE SECRETS BASELINE (if not exists)
# ==============================================================================

echo ""
echo "4. Checking secrets baseline..."

if [ ! -f "$PROJECT_ROOT/.secrets.baseline" ]; then
    echo "Generating initial secrets baseline..."
    echo "This scans for existing secrets and creates a baseline file."
    echo ""
    
    # Generate baseline, excluding common false positives
    detect-secrets scan \
        --exclude-files 'package-lock\.json' \
        --exclude-files '\.env\.example' \
        --exclude-files 'node_modules/.*' \
        --exclude-files '.*\.lock' \
        --exclude-files 'vendor/.*' \
        > "$PROJECT_ROOT/.secrets.baseline"
    
    echo -e "${GREEN}Secrets baseline created at .secrets.baseline${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Review .secrets.baseline for false positives${NC}"
    echo "Run: detect-secrets audit .secrets.baseline"
else
    echo -e "${GREEN}Secrets baseline already exists${NC}"
fi

# ==============================================================================
# INSTALL GIT HOOKS
# ==============================================================================

echo ""
echo "5. Installing pre-commit hooks..."

pre-commit install
pre-commit install --hook-type pre-push

echo -e "${GREEN}Git hooks installed successfully${NC}"

# ==============================================================================
# RUN INITIAL SCAN
# ==============================================================================

echo ""
echo "6. Running initial secret scan..."
echo ""

# Run pre-commit on all files
if pre-commit run --all-files; then
    echo ""
    echo -e "${GREEN}=============================================="
    echo "All checks passed! No secrets detected."
    echo "==============================================${NC}"
else
    echo ""
    echo -e "${YELLOW}=============================================="
    echo "Some checks failed. This might be due to:"
    echo "1. Actual secrets in the codebase (FIX IMMEDIATELY)"
    echo "2. False positives (add to .secrets.baseline)"
    echo ""
    echo "To update baseline for false positives:"
    echo "  detect-secrets scan > .secrets.baseline"
    echo "  detect-secrets audit .secrets.baseline"
    echo "==============================================${NC}"
fi

# ==============================================================================
# SUMMARY
# ==============================================================================

echo ""
echo "=============================================="
echo "Setup Complete!"
echo "=============================================="
echo ""
echo "What happens now:"
echo "- Every commit will be scanned for secrets"
echo "- Every push will run npm audit"
echo "- Commits with detected secrets will be BLOCKED"
echo ""
echo "Commands:"
echo "  pre-commit run --all-files   # Scan all files"
echo "  detect-secrets audit .secrets.baseline   # Review baseline"
echo "  gitleaks detect --verbose    # Run gitleaks manually"
echo ""
echo "If you get false positives:"
echo "1. Run: detect-secrets audit .secrets.baseline"
echo "2. Mark false positives as safe"
echo "3. Commit the updated .secrets.baseline"
echo ""
