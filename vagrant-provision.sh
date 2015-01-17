#!/bin/bash

case $(id -u) in
    0) 
     	echo "Running root user provisioning..."
     	apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y
		apt-get install -y git nodejs nodejs-legacy npm realpath
		npm install -g sails
		npm install -g grunt-cli
		npm install -g bower
		
     	# Execute this script as the vagrant user once root provisioning is
     	# completed.
        
        THISSCRIPT=$(realpath $0)
     	sudo -u vagrant -i $THISSCRIPT
 	;;
    *) 
     	echo "Running vagrant user provisioning..."
     	git clone https://github.com/xcjs/courierchat.git
		cd courierchat/www/
		npm install
		bower install --config.interactive=false
        screen -S courierchat -d -m bash -c 'sails lift'
 	;;
esac
