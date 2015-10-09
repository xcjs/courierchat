/**
* User.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

'use strict';

var Waterline = require('waterline');

var User = Waterline.Collection.extend({
	identity: 'user',

	connection: 'redis',

	attributes: {
		id: {
			type: 'integer',
			required: true,
			primaryKey: true
		},
		sessionId: {
			type: 'string',
			required: true,
			unique: true
		},
		name: {
			type: 'string',
			required: true,
			unique: true
		},
		room: {
			model: 'Room'
		},
		creator: {
			type: 'bool',
			required: true
		},
		messages: {
			collection: 'message',
			via: 'user'
		}
	}
});

module.exports = User;
