#!/bin/bash

echo "Fetching the NodeSource script to install Node.js 4.x..."
curl -sL https://deb.nodesource.com/setup_4.x | sudo bash - >/dev/null 2>&1

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

# Updated npm for Sails since the Ubuntu-packaged version may be outdated.
echo "Checking for updates to NPM..."
sudo npm install -g npm

# Delete the hash for npm since we need bash to find the new version.
sudo hash -d npm

echo "Installing Bower..."
sudo npm install -g bower

echo "Installing Gulp..."
sudo npm install -g gulp

cd /vagrant

# npm creates symlinks within packages, which doesn't work within VirtualBox on Windows well.
echo "Installing NPM dependencies..."
npm install -–no-bin-links

echo "Installing Bower dependencies..."
bower install --config.interactive=false

echo "Building CourierChat..."
gulp build

echo "Starting CourierChat..."
screen -dmS courierchat bash -c "cd /vagrant && npm start"

echo "CourierChat is now available on your host at http://localhost:8001"
