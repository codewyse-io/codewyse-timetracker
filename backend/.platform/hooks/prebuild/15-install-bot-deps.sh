#!/bin/sh

echo '========================================='
echo 'Installing meeting bot dependencies'
echo '========================================='

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

# Install required runtime libraries for Chromium (these ARE in default repos)
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

# Try to install ffmpeg from the default repos (Amazon Linux 2023)
sudo $PKG_MGR install -y ffmpeg 2>&1 || echo "ffmpeg not in default repos"

# Try multiple chromium package names
echo "--- Attempting Chromium install ---"
sudo $PKG_MGR install -y chromium 2>&1 || \
sudo $PKG_MGR install -y chromium-browser 2>&1 || \
sudo $PKG_MGR install -y google-chrome-stable 2>&1 || \
echo "System chromium install failed — will rely on bundled puppeteer chromium"

# Verify installations
echo "--- Verifying installs ---"
CHROMIUM_PATH=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || which google-chrome-stable 2>/dev/null || echo "")
echo "Chromium: ${CHROMIUM_PATH:-NOT FOUND}"
which pulseaudio || echo "PulseAudio NOT found"
which ffmpeg || echo "ffmpeg NOT found"

# Set Puppeteer executable path env var ONLY if Chromium binary actually exists
if [ -n "$CHROMIUM_PATH" ] && [ -x "$CHROMIUM_PATH" ]; then
  echo "Setting PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH"
  if [ -f /var/app/staging/.env ]; then
    grep -v '^PUPPETEER_EXECUTABLE_PATH=' /var/app/staging/.env > /tmp/env.tmp || true
    echo "PUPPETEER_EXECUTABLE_PATH=$CHROMIUM_PATH" >> /tmp/env.tmp
    mv /tmp/env.tmp /var/app/staging/.env
  fi
else
  echo "WARNING: No system Chromium found. Puppeteer will attempt to download its bundled version."
  # Remove any stale PUPPETEER_EXECUTABLE_PATH so puppeteer falls back to its bundled chromium
  if [ -f /var/app/staging/.env ]; then
    grep -v '^PUPPETEER_EXECUTABLE_PATH=' /var/app/staging/.env > /tmp/env.tmp || true
    grep -v '^PUPPETEER_SKIP_DOWNLOAD=' /tmp/env.tmp > /tmp/env.tmp2 || true
    mv /tmp/env.tmp2 /var/app/staging/.env
  fi
fi

echo '========================================='
echo 'Bot dependencies install completed'
echo '========================================='

echo '========================================='
echo 'Bot dependencies install completed'
echo '========================================='
