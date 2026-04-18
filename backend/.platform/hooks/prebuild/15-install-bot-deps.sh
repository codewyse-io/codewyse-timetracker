#!/bin/sh

echo '========================================='
echo 'Checking meeting bot dependencies'
echo '========================================='

ENV_FILE=/var/app/staging/.env

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

# Real idempotency check: verify the binaries actually exist
HAS_PACTL=$(command -v pactl 2>/dev/null || echo "")
HAS_FFMPEG=$(command -v ffmpeg 2>/dev/null || echo "")
HAS_XVFB=$(command -v Xvfb 2>/dev/null || echo "")

if [ -n "$HAS_PACTL" ] && [ -n "$HAS_FFMPEG" ] && [ -n "$HAS_XVFB" ]; then
  echo "All deps already installed — skipping package install"
  # Ensure the persistent profile dir exists + webapp can write to it
  sudo mkdir -p /var/cache/playwright/bot-profile
  sudo chown -R webapp:webapp /var/cache/playwright/bot-profile 2>/dev/null || true
  sudo chmod 700 /var/cache/playwright/bot-profile 2>/dev/null || true
  set_env_var "PULSE_SERVER" "unix:/var/run/pulse/native"
  set_env_var "DISPLAY" ":99"
  set_env_var "BOT_PROFILE_DIR" "/var/cache/playwright/bot-profile"
  echo '========================================='
  exit 0
fi

echo "Missing deps detected (pactl=${HAS_PACTL:-MISSING}, ffmpeg=${HAS_FFMPEG:-MISSING}, Xvfb=${HAS_XVFB:-MISSING}) — installing"

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

# Install required runtime libraries for Chromium + audio + Xvfb
sudo $PKG_MGR install -y \
  pulseaudio \
  pulseaudio-utils \
  xorg-x11-server-Xvfb \
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

# Try to install ffmpeg (may need EPEL or fall back to static binary)
sudo $PKG_MGR install -y ffmpeg 2>&1 || {
  echo "ffmpeg not in default repos — attempting static binary download"
  if [ ! -f /usr/local/bin/ffmpeg ]; then
    cd /tmp
    ARCH=$(uname -m)
    if [ "$ARCH" = "aarch64" ]; then
      FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
    else
      FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
    fi
    curl -sLO "$FFMPEG_URL" && \
      tar -xf ffmpeg-release-*-static.tar.xz && \
      sudo cp ffmpeg-*-static/ffmpeg /usr/local/bin/ffmpeg && \
      sudo chmod +x /usr/local/bin/ffmpeg && \
      echo "Installed static ffmpeg to /usr/local/bin/ffmpeg" || \
      echo "Static ffmpeg install failed"
    rm -rf /tmp/ffmpeg-release-*-static.tar.xz /tmp/ffmpeg-*-static
  fi
}

# Install tigervnc-server (Xvnc) so the operator can connect remotely to log
# the bot into Google on the same IP as the production bot. x11vnc isn't
# available in Amazon Linux 2023 default repos; Xvnc is the supported alternative.
sudo $PKG_MGR install -y tigervnc-server tigervnc-server-minimal 2>&1 || echo "tigervnc install failed (not critical — needed only for bot login)"

# Verify installations
echo "--- Verifying installs ---"
which pactl || echo "pactl NOT found"
which pulseaudio || echo "pulseaudio NOT found"
which ffmpeg || echo "ffmpeg NOT found"
which Xvnc || echo "Xvnc NOT found (optional, for bot login only)"

# Create the persistent bot profile dir. It persists across deploys because
# it lives in /var/cache/, not /var/app/. The bot account's Google session
# (cookies, localStorage, IndexedDB, service workers) lives here.
sudo mkdir -p /var/cache/playwright/bot-profile
sudo chown -R webapp:webapp /var/cache/playwright/bot-profile
sudo chmod 700 /var/cache/playwright/bot-profile

# Tell the runtime app where the PulseAudio system socket lives
set_env_var "PULSE_SERVER" "unix:/var/run/pulse/native"

# Tell the runtime app to use the Xvfb virtual display
set_env_var "DISPLAY" ":99"

# Point the bot at its persistent profile dir. When this path exists and is
# non-empty, the bot uses launchPersistentContext — the only reliable way to
# keep Google signed in across runs from an AWS datacenter IP.
set_env_var "BOT_PROFILE_DIR" "/var/cache/playwright/bot-profile"

echo '========================================='
echo 'Bot dependencies install completed'
echo '========================================='
