#!/bin/bash

echo "Fetching the NodeSource script to install Node.js 5.x..."
curl -sL https://deb.nodesource.com/setup_5.x | sudo bash - >/dev/null 2>&1

echo "Checking for system updates..."
sudo apt-get -qq update

echo "Installing system updates..."
sudo apt-get -qq upgrade && sudo apt-get -qq dist-upgrade

echo "Cleaning up leftover system packages..."
sudo apt-get -qq autoremove

echo "Installing git..."
sudo apt-get -qq install git

echo "Installing Node.js and NPM..."
sudo apt-get -qq install nodejs

echo "Installing Redis..."
sudo apt-get -qq install redis-server

# Updated npm for Sails since the Ubuntu-packaged version may be outdated.
echo "Checking for updates to NPM..."
sudo npm install -g npm

# Delete the hash for npm since we need bash to find the new version.
hash -d npm

echo "Installing Bower..."
sudo npm install -g bower

echo "Installing Gulp..."
sudo npm install -g gulp

echo "Installing Express..."
sudo npm install -g express@4.x

echo "Disabling the Redis disk sync..."
sudo sed -i "/^save.*/d" /etc/redis/redis.conf
sudo service redis-server restart

cd /vagrant

# npm creates symlinks within packages, which doesn't work within VirtualBox on Windows well.
echo "Installing NPM dependencies..."
npm install -–no-bin-links

echo "Installing Bower dependencies..."
bower install --config.interactive=false

echo "Performing a development build..."
gulp build

echo "Starting the Express server..."
screen -dmS courierchat bash -c "cd /vagrant && npm start"

echo "CourierChat is now available on your host at http://localhost:3000"
