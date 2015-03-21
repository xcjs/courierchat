#!/bin/bash

# Determine the user ID of the user executing this script.
case $(id -u) in
    0) 
     	echo "Running root user provisioning..."
     	apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y
		apt-get install -y git nodejs nodejs-legacy npm redis-server realpath

        # Updated npm for Sails since the Ubuntu-packaged version is too old.
        npm install -g npm

        # Delete the hash for npm since we need bash to find the new version.
        hash -d npm

        npm install -g grunt-cli
        npm install -g bower
        npm install -g sails
		
        # Disable saving to disk for Redis.
        sed -i "/^save.*/d" /etc/redis/redis.conf
        service redis-server restart

     	# Execute this script as the vagrant user once root provisioning is
     	# completed.

        THISSCRIPT=$(realpath $0)
        chown vagrant $THISSCRIPT
        sudo -u vagrant -i $THISSCRIPT
 	;;
    *) 
     	echo "Running vagrant user provisioning..."
		cd courierchat/

        # npm creates symlinks within packages, which doesn't work within VirtualBox on Windows well.
		npm install -–no-bin-link

		bower install --config.interactive=false
        
        echo "Starting the Sails server..."
        screen -S sails -d -m bash -c 'sails lift'
 	;;
esac
