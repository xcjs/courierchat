sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get upgrade -y
sudo apt-get install -y git nodejs nodejs-legacy npm
sudo npm install -g sails
sudo npm install -g grunt-cli
sudo npm install -g bower
git clone https://github.com/xcjs/courierchat.git
cd courierchat/www/
npm install
bower install --config.interactive=false