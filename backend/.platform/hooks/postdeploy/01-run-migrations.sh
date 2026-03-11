#!/bin/sh

echo '========================================='
echo 'Running database migrations'
echo '========================================='

# Check for leader file
if [ -f /opt/elasticbeanstalk/.leader-only ]; then
  echo 'Leader file found - this is the leader instance'
  IS_LEADER=true
else
  echo 'No leader file - assuming single instance or always run mode'
  IS_LEADER=true
fi

if [ "$IS_LEADER" = true ]; then
  cd /var/app/current

  echo 'Running migrations...'
  if npm run migration:prod; then
    echo 'Migrations completed successfully'
  else
    echo 'Warning: Migration command failed or no migrations to run'
  fi
else
  echo 'Skipping migrations and seeds on non-leader instance'
fi

echo '========================================='
