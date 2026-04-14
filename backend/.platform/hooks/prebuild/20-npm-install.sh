#!/bin/sh

# Do NOT use `set -e` — we want to check exit codes manually so we can log
# useful errors to stderr (which is what EB captures in the deploy log).

echo '========================================='
echo 'Installing Node.js dependencies'
echo '========================================='

ENV_FILE=/var/app/staging/.env
PLAYWRIGHT_CACHE=/var/cache/playwright

# Helper: safely set or remove a key in .env without losing other vars
set_env_var() {
  local key="$1"
  local value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    echo "WARNING: $ENV_FILE does not exist, cannot set $key"
    return
  fi
  sed -i "/^${key}=/d" "$ENV_FILE"
  if [ -n "$value" ]; then
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Create swap if not already present (builds can be memory-hungry).
# 2GB swap so the TS compiler doesn't OOM on a 4GB instance.
if [ ! -f /var/swapfile ]; then
  echo 'Creating 2GB swap file...'
  dd if=/dev/zero of=/var/swapfile bs=1M count=2048
  chmod 600 /var/swapfile
  mkswap /var/swapfile
  swapon /var/swapfile
  echo 'Swap enabled'
elif ! swapon --show | grep -q /var/swapfile; then
  swapon /var/swapfile
  echo 'Swap re-enabled'
fi

# Skip Playwright's automatic browser download during npm install — we install
# Chromium to a shared cache path separately below, so letting npm's postinstall
# download to the default cache is wasted time + disk.
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install ALL dependencies (including devDependencies) so we can build the TS
echo '--- npm install (with devDeps for build) ---'
npm install --no-audit --no-fund 2>&1
INSTALL_EXIT=$?
if [ $INSTALL_EXIT -ne 0 ]; then
  echo "ERROR: npm install failed with exit code $INSTALL_EXIT" >&2
  exit $INSTALL_EXIT
fi

# Compile TypeScript → dist/
# Redirect stdout→stderr so EB surfaces any build errors in the deploy log
echo '--- Building backend (nest build) ---'
npm run build 2>&1 1>&2
BUILD_EXIT=$?

echo "--- Post-build state ---" >&2
ls -la dist/ 2>&1 >&2 || echo 'dist/ does not exist' >&2

if [ $BUILD_EXIT -ne 0 ]; then
  echo "ERROR: nest build failed with exit code $BUILD_EXIT" >&2
  exit $BUILD_EXIT
fi

if [ ! -f dist/main.js ]; then
  echo 'ERROR: dist/main.js was not produced by nest build' >&2
  exit 1
fi

echo "Build complete: $(ls -la dist/main.js)" >&2

# Prune devDependencies to save disk space
echo '--- Pruning devDependencies ---' >&2
npm prune --omit=dev --no-audit --no-fund 2>&1 1>&2 || echo 'Prune failed (non-fatal)' >&2

# Install Playwright Chromium to a shared cache directory so webapp user can read it
sudo mkdir -p "$PLAYWRIGHT_CACHE"
sudo chmod 755 "$PLAYWRIGHT_CACHE"

# Check if chromium binary already exists in shared cache (true idempotency check)
EXISTING_CHROME=$(find "$PLAYWRIGHT_CACHE" -type f -name 'headless_shell' 2>/dev/null | head -1)
if [ -z "$EXISTING_CHROME" ]; then
  EXISTING_CHROME=$(find "$PLAYWRIGHT_CACHE" -type f -name 'chrome' 2>/dev/null | head -1)
fi

if [ -n "$EXISTING_CHROME" ] && [ -x "$EXISTING_CHROME" ]; then
  echo "Playwright Chromium already installed at: $EXISTING_CHROME"
else
  echo 'Installing Playwright Chromium to /var/cache/playwright...'
  # Playwright reads PLAYWRIGHT_BROWSERS_PATH for cache location
  sudo PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_CACHE" npx playwright install chromium 2>&1 || {
    echo 'Playwright chromium install failed — trying with deps'
    sudo PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_CACHE" npx playwright install --with-deps chromium 2>&1 || \
      echo 'Playwright install failed with --with-deps as well'
  }
  EXISTING_CHROME=$(find "$PLAYWRIGHT_CACHE" -type f -name 'headless_shell' 2>/dev/null | head -1)
  if [ -z "$EXISTING_CHROME" ]; then
    EXISTING_CHROME=$(find "$PLAYWRIGHT_CACHE" -type f -name 'chrome' 2>/dev/null | head -1)
  fi
fi

# Make the entire cache dir world-readable+executable so webapp user can run chromium
sudo chmod -R a+rX "$PLAYWRIGHT_CACHE" 2>/dev/null || true

# Persist settings into .env so the runtime app can find Chromium
set_env_var "PLAYWRIGHT_BROWSERS_PATH" "$PLAYWRIGHT_CACHE"
if [ -n "$EXISTING_CHROME" ] && [ -x "$EXISTING_CHROME" ]; then
  echo "Playwright Chromium found at: $EXISTING_CHROME"
else
  echo "WARNING: No playwright chromium binary found after install"
fi

echo ''
echo '========================================='
echo 'Dependencies installed successfully'
echo '========================================='
