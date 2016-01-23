'use strict';

var config = {
	security: {
		secret: process.env.COURIERCHAT_SECRET
	},
	storage: {
		redis: {
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
	}
};

module.exports = config;
