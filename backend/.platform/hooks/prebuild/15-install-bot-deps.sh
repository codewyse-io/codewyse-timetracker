#!/bin/sh

echo '========================================='
echo 'Checking meeting bot dependencies'
echo '========================================='

MARKER_FILE=/var/cache/pulsetrack-bot-deps-installed
ENV_FILE=/var/app/staging/.env

# Helper: safely set or remove a key in .env without losing other vars
set_env_var() {
  local key="$1"
  local value="$2"
  if [ ! -f "$ENV_FILE" ]; then
    echo "WARNING: $ENV_FILE does not exist, cannot set $key"
    return
  fi
  # Filter out the existing line (if any), then append new value
  sed -i "/^${key}=/d" "$ENV_FILE"
  if [ -n "$value" ]; then
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

detect_chromium() {
  which chromium-browser 2>/dev/null || which chromium 2>/dev/null || which google-chrome-stable 2>/dev/null || echo ""
}

# Skip if already installed (idempotent — runs only once per instance)
if [ -f "$MARKER_FILE" ]; then
  echo "Bot dependencies already installed (marker: $MARKER_FILE)"
  echo "Skipping install. Delete the marker file to force reinstall."
  CHROMIUM_PATH=$(detect_chromium)
  if [ -n "$CHROMIUM_PATH" ] && [ -x "$CHROMIUM_PATH" ]; then
    set_env_var "PUPPETEER_EXECUTABLE_PATH" "$CHROMIUM_PATH"
    echo "Re-applied PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH"
  else
    set_env_var "PUPPETEER_EXECUTABLE_PATH" ""
    echo "No system Chromium found — using bundled Puppeteer Chromium"
  fi
  echo '========================================='
  exit 0
fi

echo 'First-time install — proceeding with package installation'

# Detect package manager
if command -v dnf >/dev/null 2>&1; then
  PKG_MGR="dnf"
elif command -v yum >/dev/null 2>&1; then
  PKG_MGR="yum"
else
  echo "No package manager found, skipping"
  exit 0
fi

echo "Using package manager: $PKG_MGR"
echo "OS info:"
cat /etc/os-release || true

# Install required runtime libraries for Chromium
sudo $PKG_MGR install -y \
  pulseaudio \
  dbus \
  dbus-x11 \
  nss \
  atk \
  at-spi2-atk \
  cups-libs \
  libdrm \
  libgbm \
  libXcomposite \
  libXdamage \
  libXfixes \
  libXrandr \
  libxshmfence \
  alsa-lib \
  pango \
  cairo \
  gtk3 \
  liberation-fonts \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-utils \
  xorg-x11-fonts-cyrillic \
  xorg-x11-fonts-Type1 \
  xorg-x11-fonts-misc 2>&1 || echo "Some libs failed (may not be critical)"

# Try to install ffmpeg
sudo $PKG_MGR install -y ffmpeg 2>&1 || echo "ffmpeg not in default repos"

# Try multiple chromium package names
echo "--- Attempting Chromium install ---"
sudo $PKG_MGR install -y chromium 2>&1 || \
sudo $PKG_MGR install -y chromium-browser 2>&1 || \
sudo $PKG_MGR install -y google-chrome-stable 2>&1 || \
echo "System chromium install failed — will rely on bundled puppeteer chromium"

# Verify installations
echo "--- Verifying installs ---"
CHROMIUM_PATH=$(detect_chromium)
echo "Chromium: ${CHROMIUM_PATH:-NOT FOUND}"
which pulseaudio || echo "PulseAudio NOT found"
which ffmpeg || echo "ffmpeg NOT found"

# Update PUPPETEER_EXECUTABLE_PATH in .env
if [ -n "$CHROMIUM_PATH" ] && [ -x "$CHROMIUM_PATH" ]; then
  set_env_var "PUPPETEER_EXECUTABLE_PATH" "$CHROMIUM_PATH"
  echo "Set PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH"
else
  set_env_var "PUPPETEER_EXECUTABLE_PATH" ""
  echo "No system Chromium — Puppeteer will use bundled version"
fi

# Create marker file so subsequent deploys skip the install
sudo mkdir -p /var/cache 2>/dev/null || true
sudo touch "$MARKER_FILE"
echo "Created marker: $MARKER_FILE"

echo '========================================='
echo 'Bot dependencies install completed'
echo '========================================='
