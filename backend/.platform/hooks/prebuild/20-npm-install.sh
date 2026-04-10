#!/bin/sh

set -e

echo '========================================='
echo 'Installing Node.js dependencies'
echo '========================================='

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

# Ensure Puppeteer Chromium is downloaded (only on first deploy — idempotent)
PUPPETEER_MARKER=/var/cache/pulsetrack-puppeteer-chrome-installed
if [ ! -f "$PUPPETEER_MARKER" ]; then
  echo 'Installing Puppeteer Chromium (first-time only)...'
  if PUPPETEER_SKIP_DOWNLOAD=false npx puppeteer browsers install chrome 2>&1; then
    sudo mkdir -p /var/cache 2>/dev/null || true
    sudo touch "$PUPPETEER_MARKER"
    echo "Created marker: $PUPPETEER_MARKER"
  else
    echo 'Puppeteer browser install failed'
  fi
else
  echo 'Puppeteer Chromium already installed, skipping'
fi

echo ''
echo '========================================='
echo 'Dependencies installed successfully'
echo '========================================='
