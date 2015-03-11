#!/bin/bash

# Determine the user ID of the user executing this script.
case $(id -u) in
    0) 
     	echo "Running root user provisioning..."
     	apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y
		apt-get install -y git nodejs nodejs-legacy npm redis-server realpath
		npm install -g npm
        npm install -g sails
		npm install -g grunt-cli
		npm install -g bower
		
        # Disable saving to disk for Redis.
        sed -i "/^save.*/d" /var/redis/redis.conf

     	# Execute this script as the vagrant user once root provisioning is
     	# completed.

        THISSCRIPT=$(realpath $0)
        chown vagrant $THISSCRIPT
        sudo -u vagrant -i $THISSCRIPT
 	;;
    *) 
     	echo "Running vagrant user provisioning..."
     	git clone https://github.com/xcjs/courierchat.git
		cd courierchat/www/
		npm install
		bower install --config.interactive=false
        echo "Starting the Sails server..."
        screen -S sails -d -m bash -c 'sails lift'
        echo "Starting the Redis server..."
        screen -S redis -d -m bash -c 'redis-server'
 	;;
esac
