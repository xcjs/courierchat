var Waterline = require('waterline');

/**
* Message.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

var Message = Waterline.Collection.extend({
	identity: 'message',

	connection: 'redis',

	attributes: {
		id: {
			type: 'integer',
			required: true,
			primaryKey: true
		},
		message: {
			type: 'string',
			required: true
		},
		timestamp: {
			type: 'datetime',
			required: true
		},
		user: {
			model: 'user'
		},
		room: {
			model: 'room'
		}
	}
});

module.exports = Message;
