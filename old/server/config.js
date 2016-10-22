'use strict';

var redisAdapter = require('sails-redis');

var config = {
	adapters: {
		redis: redisAdapter
	},
	connections: {
		redis: {
			adapter: 'redis',
			port: 6379,
			host: 'localhost',
			password: null,
			database: null,
			options: {

				// low-level configuration
				// (redis driver options)
				parser: 'hiredis',
				return_buffers: false,
				detect_buffers: false,
				socket_nodelay: true,
				no_ready_check: false,
				enable_offline_queue: true
			}
		}
	},
	defaults: {
		migrate: 'alter'
	},
	security: {
		secret: process.env.COURIERCHAT_SECRET
	}
};

module.exports = config;
