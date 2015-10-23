#!/bin/bash

echo "Fetching the NodeSource script to install Node.js 4.x..."
curl -sL https://deb.nodesource.com/setup_4.x | bash -

echo "Checking for and Installing system updates..."
apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y && apt-get autoremove -y

echo "Installing git, nodejs, npm, and redis-server..."
apt-get install -qq git nodejs redis-server

# Updated npm for Sails since the Ubuntu-packaged version may be outdated.
echo "Checking for updates to NPM..."
npm install -g npm

# Delete the hash for npm since we need bash to find the new version.
hash -d npm

echo "Installing Grunt, Bower, and Sails globally..."
npm install -g grunt-cli
npm install -g bower
npm install -g sails

echo "Disabling the Redis disk sync..."
sed -i "/^save.*/d" /etc/redis/redis.conf
service redis-server restart

cd /vagrant/www

# npm creates symlinks within packages, which doesn't work within VirtualBox on Windows well.
echo "Installing NPM dependencies..."
npm install -–no-bin-links

echo "Installing Bower dependencies..."
bower install --config.interactive=false --allow-root

echo "Starting the Sails server..."
sudo -i -u vagrant cd /vagrant/www && screen -dmS courierchat sails lift
