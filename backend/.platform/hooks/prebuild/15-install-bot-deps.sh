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

if [ -n "$HAS_PACTL" ] && [ -n "$HAS_FFMPEG" ]; then
  echo "PulseAudio + ffmpeg already installed (pactl=$HAS_PACTL, ffmpeg=$HAS_FFMPEG) — skipping package install"
  # Still ensure the runtime env var is set in .env on every deploy
  set_env_var "PULSE_SERVER" "unix:/var/run/pulse/native"
  echo '========================================='
  exit 0
fi

echo "Missing deps detected (pactl=${HAS_PACTL:-MISSING}, ffmpeg=${HAS_FFMPEG:-MISSING}) — installing"

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

# Install required runtime libraries for Chromium + audio
sudo $PKG_MGR install -y \
  pulseaudio \
  pulseaudio-utils \
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

# Verify installations
echo "--- Verifying installs ---"
which pactl || echo "pactl NOT found"
which pulseaudio || echo "pulseaudio NOT found"
which ffmpeg || echo "ffmpeg NOT found"

# Tell the runtime app where the PulseAudio system socket lives
set_env_var "PULSE_SERVER" "unix:/var/run/pulse/native"

echo '========================================='
echo 'Bot dependencies install completed'
echo '========================================='
