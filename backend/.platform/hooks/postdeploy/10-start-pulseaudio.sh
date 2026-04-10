#!/bin/sh

echo '========================================='
echo 'Starting PulseAudio in system mode'
echo '========================================='

# PulseAudio in system mode runs as a daemon shared by all users.
# This is the supported way to run it on a headless server (vs per-user mode).
# Reference: https://www.freedesktop.org/wiki/Software/PulseAudio/Documentation/User/SystemWide/

if ! command -v pulseaudio >/dev/null 2>&1; then
  echo "PulseAudio not installed — skipping"
  exit 0
fi

# Kill any leftover pulseaudio processes from previous runs
sudo pkill -9 pulseaudio 2>/dev/null || true
sleep 1

# Ensure pulse user/group exist (created by pulseaudio rpm)
id pulse >/dev/null 2>&1 || sudo useradd -r -s /sbin/nologin -d /var/run/pulse pulse
getent group pulse-access >/dev/null 2>&1 || sudo groupadd pulse-access
getent group pulse-rt >/dev/null 2>&1 || sudo groupadd pulse-rt

# Add the webapp user to pulse-access so the bot process can connect
sudo usermod -a -G pulse-access webapp 2>/dev/null || true

# Create runtime dir
sudo mkdir -p /var/run/pulse
sudo chown pulse:pulse /var/run/pulse

# Start PulseAudio in system mode (background daemon)
sudo pulseaudio --system --disallow-exit --disallow-module-loading=false --daemonize=yes --log-target=syslog 2>&1 || {
  echo "system-mode start failed, trying without --disallow-* flags"
  sudo pulseaudio --system --daemonize=yes --log-target=syslog 2>&1 || true
}

sleep 2

# Verify it's running by checking the system socket
if [ -S /var/run/pulse/native ] || [ -S /run/pulse/native ]; then
  echo "PulseAudio system socket exists"
  sudo chmod 777 /var/run/pulse/native 2>/dev/null || true
  sudo chmod 777 /run/pulse/native 2>/dev/null || true
else
  echo "WARNING: PulseAudio system socket not found"
fi

# Quick check: can pactl talk to it as the webapp user?
if sudo -u webapp PULSE_SERVER=unix:/var/run/pulse/native pactl info >/dev/null 2>&1; then
  echo "webapp user can connect to PulseAudio system daemon"
elif sudo -u webapp PULSE_SERVER=unix:/run/pulse/native pactl info >/dev/null 2>&1; then
  echo "webapp user can connect to PulseAudio system daemon (via /run/pulse)"
else
  echo "WARNING: webapp user CANNOT connect to PulseAudio — bot audio capture will fail"
  ps -ef | grep -i pulseaudio | grep -v grep || echo "no pulseaudio process running"
fi

echo '========================================='
