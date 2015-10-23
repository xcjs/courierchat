#!/bin/bash

echo "Fetching the NodeSource script to install Node.js 4.x..."
curl -sL https://deb.nodesource.com/setup_4.x | bash - >/dev/null 2>&1

echo "Checking for system updates..."
apt-get -qq update

echo "Installing system upgrades..."
apt-get -qq upgrade >/dev/null 2>&1

echo "Installing system upgrades with new dependencies..."
apt-get -qq dist-upgrade >/dev/null 2>&1

echo "Cleaning up after installing updates..."
apt-get -qq autoremove >/dev/null 2>&1

echo "Installing git..."
apt-get -qq install git >/dev/null 2>&1

echo "Installing Node.js and NPM..."
apt-get -qq install nodejs >/dev/null 2>&1

echo "Installing Redis..."
apt-get -qq install redis-server >/dev/null 2>&1

# Updated npm for Sails since the Ubuntu-packaged version may be outdated.
echo "Checking for updates to NPM..."
npm install -g npm >/dev/null 2>&1

# Delete the hash for npm since we need bash to find the new version.
hash -d npm

echo "Installing Grunt..."
npm install -g grunt-cli >/dev/null 2>&1

echo "Installing Bower..."
npm install -g bower >/dev/null 2>&1

echo "Installing Sails..."
npm install -g sails >/dev/null 2>&1

echo "Disabling the Redis disk sync..."
sed -i "/^save.*/d" /etc/redis/redis.conf
service redis-server restart >/dev/null 2>&1

cd /vagrant/www

# npm creates symlinks within packages, which doesn't work within VirtualBox on Windows well.
echo "Installing NPM dependencies..."
npm install -–no-bin-links >/dev/null 2>&1

echo "Installing Bower dependencies..."
bower install --config.interactive=false --allow-root >/dev/null 2>&1

echo "Starting the Sails server..."
sudo -i -u vagrant cd /vagrant/www && screen -dmS courierchat sails lift

echo "CourierChat is now available on your host at http://localhost:1337"
