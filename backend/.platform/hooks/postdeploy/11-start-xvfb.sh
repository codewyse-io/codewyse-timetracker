#!/bin/sh

echo '========================================='
echo 'Starting Xvfb virtual display'
echo '========================================='

if ! command -v Xvfb >/dev/null 2>&1; then
  echo "Xvfb not installed — skipping (Meet bot will likely fail bot-detection)"
  exit 0
fi

# Kill any existing Xvfb on display :99
sudo pkill -9 -f 'Xvfb :99' 2>/dev/null || true
sleep 1

# Start Xvfb on display :99 in background
sudo Xvfb :99 -screen 0 1280x720x24 -ac -nolisten tcp -dpi 96 +extension RANDR > /tmp/xvfb.log 2>&1 &
disown 2>/dev/null || true
sleep 2

# Verify
if pgrep -f 'Xvfb :99' >/dev/null; then
  echo "Xvfb running on :99"
  sudo chmod 1777 /tmp/.X11-unix 2>/dev/null || true
else
  echo "WARNING: Xvfb failed to start — see /tmp/xvfb.log"
  cat /tmp/xvfb.log 2>/dev/null || true
fi

echo '========================================='
