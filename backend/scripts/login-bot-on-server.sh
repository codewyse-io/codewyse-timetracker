#!/bin/bash
#
# One-time bot Google login on the Elastic Beanstalk server.
#
# Starts a web-accessible VNC session (noVNC) that you open in your normal
# browser. Chromium runs on the server's Xvfb display and you can drive it
# with your mouse/keyboard via a web page. Since the login happens on the
# server's AWS IP, Google ties the cookies to that IP — no mismatch, no
# invalidation.
#
# HOW TO USE (three windows needed):
#
# WINDOW 1 — On the EB instance (via `eb ssh` OR AWS Instance Connect):
#     sudo bash /var/app/current/scripts/login-bot-on-server.sh
#   Keep this terminal open. It starts noVNC on localhost:6080.
#
# WINDOW 2 — Forward port 6080 from your local machine to the EB instance.
#   Pick ONE of:
#
#   A) AWS Session Manager (works without SSH keys — simplest):
#        aws ssm start-session \
#          --target <your-ec2-instance-id> \
#          --document-name AWS-StartPortForwardingSession \
#          --parameters '{"portNumber":["6080"],"localPortNumber":["6080"]}'
#      Get your instance id from the EB console → Health → instance id.
#
#   B) Classic SSH tunnel (if you have the PEM key):
#        ssh -i ~/.ssh/<your-key.pem> -L 6080:localhost:6080 ec2-user@<eb-host>
#
# WINDOW 3 — Open your normal browser (Chrome, Firefox, Edge) at:
#     http://localhost:6080/vnc.html?autoconnect=1&resize=remote
#
# In that browser you'll see the Chromium on the server. Sign in with the bot
# Gmail account, complete 2FA if prompted, visit meet.google.com once to warm
# the Meet cookies, then CLOSE the Chromium window (profile auto-saves).
#
# Back in Window 1, Ctrl+C to stop the server. Done. The bot now has a
# persistent profile at /var/cache/playwright/bot-profile/ that survives
# deploys.

set -e

PROFILE_DIR="${BOT_PROFILE_DIR:-/var/cache/playwright/bot-profile}"
NOVNC_PORT=6080
VNC_PORT=5900
CHROMIUM_PATH=$(find /var/cache/playwright -type f -name chrome 2>/dev/null | head -1)

if [ -z "$CHROMIUM_PATH" ]; then
  echo "ERROR: Playwright Chromium not found at /var/cache/playwright"
  echo "       Run a deploy first — the prebuild hook installs it."
  exit 1
fi

# Ensure x11vnc is installed (prebuild hook does this, but double-check)
if ! command -v x11vnc >/dev/null 2>&1; then
  echo "Installing x11vnc..."
  sudo dnf install -y x11vnc || sudo yum install -y x11vnc
fi

# Ensure noVNC + websockify are installed
if [ ! -d /opt/noVNC ]; then
  echo "Installing noVNC..."
  sudo dnf install -y git python3 python3-pip numpy || sudo yum install -y git python3 python3-pip numpy
  sudo git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC
  sudo git clone --depth 1 https://github.com/novnc/websockify.git /opt/noVNC/utils/websockify
fi

# Ensure profile dir exists and is writable by webapp
sudo mkdir -p "$PROFILE_DIR"
sudo chown -R webapp:webapp "$PROFILE_DIR"
sudo chmod 700 "$PROFILE_DIR"

# Kill any previous instances
sudo pkill -9 x11vnc 2>/dev/null || true
sudo pkill -9 -f websockify 2>/dev/null || true
sleep 1

echo '========================================='
echo "Starting x11vnc on display :99 (internal port $VNC_PORT)"
echo '========================================='

# x11vnc — bind only to localhost (we'll forward via SSM/SSH)
sudo x11vnc -display :99 -forever -shared -nopw -localhost -rfbport $VNC_PORT -bg -o /tmp/x11vnc.log

sleep 1

echo '========================================='
echo "Starting noVNC web client on port $NOVNC_PORT"
echo '========================================='

# noVNC — serves a web page that talks to x11vnc over websocket
sudo /opt/noVNC/utils/novnc_proxy \
  --vnc localhost:$VNC_PORT \
  --listen 0.0.0.0:$NOVNC_PORT \
  >/tmp/novnc.log 2>&1 &
NOVNC_PID=$!

sleep 2
if ! kill -0 $NOVNC_PID 2>/dev/null; then
  echo "ERROR: noVNC failed to start. Last log:"
  tail -20 /tmp/novnc.log
  exit 1
fi

echo ''
echo '========================================='
echo 'noVNC is running.'
echo '========================================='
echo ''
echo 'From YOUR local machine, open one port-forwarding session:'
echo ''
echo '  AWS SSM (no SSH keys needed):'
echo "    aws ssm start-session --target <ec2-instance-id> \\"
echo '      --document-name AWS-StartPortForwardingSession \\'
echo "      --parameters '{\"portNumber\":[\"$NOVNC_PORT\"],\"localPortNumber\":[\"$NOVNC_PORT\"]}'"
echo ''
echo '  OR classic SSH:'
echo "    ssh -i ~/.ssh/<key.pem> -L $NOVNC_PORT:localhost:$NOVNC_PORT ec2-user@<eb-host>"
echo ''
echo 'Then open in your browser:'
echo ''
echo "  http://localhost:$NOVNC_PORT/vnc.html?autoconnect=1&resize=remote"
echo ''
echo '========================================='
echo "Launching Chromium with profile: $PROFILE_DIR"
echo '========================================='

# Launch Chromium as the webapp user with the persistent profile dir
sudo -u webapp -E bash -c "DISPLAY=:99 '$CHROMIUM_PATH' \
  --user-data-dir='$PROFILE_DIR' \
  --no-first-run \
  --no-default-browser-check \
  --no-sandbox \
  --disable-blink-features=AutomationControlled \
  --window-size=1280,720 \
  https://accounts.google.com/signin"

echo ''
echo 'Chromium closed. Profile saved to:'
echo "  $PROFILE_DIR"
echo ''
echo 'Stopping noVNC and x11vnc...'
sudo pkill -9 -f websockify 2>/dev/null || true
sudo pkill -9 x11vnc 2>/dev/null || true
echo 'Done. The bot will use this profile on its next meeting join.'
