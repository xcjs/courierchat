var Waterline = require('waterline');

/**
* Room.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

var Room = Waterline.Collection.extend({
	identity: 'room',

	connection: 'redis',

	attributes: {
		id: {
			type: 'integer',
			required: true,
			primaryKey: true
		},
		name: {
			type: 'string',
			required: true
		},
		creationDate: {
			type: 'datetime',
			required: true
		},
		owner: {
			model: 'user'
		},
		users: {
			collection: 'user',
			via: 'room',
			required: true
		},
		messages: {
			collection: 'message',
			via: 'room',
			required: true
		}
	}
});

module.exports = Room;
