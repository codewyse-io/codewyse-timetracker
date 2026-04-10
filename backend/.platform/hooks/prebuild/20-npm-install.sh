#!/bin/sh

set -e

echo '========================================='
echo 'Installing Node.js dependencies'
echo '========================================='

ENV_FILE=/var/app/staging/.env
PUPPETEER_CACHE=/var/cache/puppeteer

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

# Create swap if not already present (t4g.micro has only 1GB RAM)
if [ ! -f /var/swapfile ]; then
  echo 'Creating 512MB swap file...'
  dd if=/dev/zero of=/var/swapfile bs=1M count=512
  chmod 600 /var/swapfile
  mkswap /var/swapfile
  swapon /var/swapfile
  echo 'Swap enabled'
elif ! swapon --show | grep -q /var/swapfile; then
  swapon /var/swapfile
  echo 'Swap re-enabled'
fi

# Install production dependencies
npm install --omit=dev --no-audit --no-fund

# Install Puppeteer Chromium to a shared cache directory so webapp user can read it
sudo mkdir -p "$PUPPETEER_CACHE"
sudo chmod 755 "$PUPPETEER_CACHE"

# Check if chrome binary already exists in shared cache (true idempotency check)
EXISTING_CHROME=$(find "$PUPPETEER_CACHE" -type f -name 'chrome' 2>/dev/null | head -1)

if [ -n "$EXISTING_CHROME" ] && [ -x "$EXISTING_CHROME" ]; then
  echo "Puppeteer Chrome already installed at: $EXISTING_CHROME"
else
  echo 'Installing Puppeteer Chromium to /var/cache/puppeteer...'
  sudo PUPPETEER_CACHE_DIR="$PUPPETEER_CACHE" PUPPETEER_SKIP_DOWNLOAD=false npx puppeteer browsers install chrome 2>&1 || {
    echo 'Puppeteer browser install failed'
  }
  EXISTING_CHROME=$(find "$PUPPETEER_CACHE" -type f -name 'chrome' 2>/dev/null | head -1)
fi

# Make the entire cache dir world-readable+executable so webapp user can run chrome
sudo chmod -R a+rX "$PUPPETEER_CACHE" 2>/dev/null || true

# Persist settings into .env so the runtime app can find Chrome
set_env_var "PUPPETEER_CACHE_DIR" "$PUPPETEER_CACHE"
if [ -n "$EXISTING_CHROME" ] && [ -x "$EXISTING_CHROME" ]; then
  set_env_var "PUPPETEER_EXECUTABLE_PATH" "$EXISTING_CHROME"
  echo "Set PUPPETEER_EXECUTABLE_PATH=$EXISTING_CHROME"
else
  echo "WARNING: No chrome binary found after install"
fi

echo ''
echo '========================================='
echo 'Dependencies installed successfully'
echo '========================================='
