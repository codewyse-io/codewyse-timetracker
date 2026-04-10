#!/bin/sh

echo '========================================='
echo 'Starting PulseAudio system daemon'
echo '========================================='

# PulseAudio needs to run as the webapp user (the user the Node app runs as)
# so the bot process can connect to its socket.

if ! command -v pulseaudio >/dev/null 2>&1; then
  echo "PulseAudio not installed — skipping"
  exit 0
fi

# Create a runtime dir for the webapp user
sudo mkdir -p /run/user/webapp
sudo chown webapp:webapp /run/user/webapp 2>/dev/null || true
sudo chmod 700 /run/user/webapp

# Kill any existing pulseaudio for the webapp user
sudo -u webapp pkill -u webapp pulseaudio 2>/dev/null || true
sleep 1

# Start PulseAudio as webapp user in daemon mode (not exit-idle)
sudo -u webapp XDG_RUNTIME_DIR=/run/user/webapp pulseaudio --start --exit-idle-time=-1 --log-target=syslog 2>&1 || {
  echo "Failed to start PulseAudio as webapp user — trying again with verbose output"
  sudo -u webapp XDG_RUNTIME_DIR=/run/user/webapp pulseaudio --start --exit-idle-time=-1 -vvv 2>&1 || true
}

# Verify it's running
sleep 2
if sudo -u webapp XDG_RUNTIME_DIR=/run/user/webapp pactl info >/dev/null 2>&1; then
  echo "PulseAudio is running for webapp user"
  sudo -u webapp XDG_RUNTIME_DIR=/run/user/webapp pactl info | head -5
else
  echo "WARNING: PulseAudio is NOT running — bot audio capture will fail"
fi

echo '========================================='
