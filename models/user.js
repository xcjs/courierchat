/**
* User.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

'use strict';

var Waterline = require('waterline');
var config = require('../config');

var User = Waterline.Collection.extend({
	identity: 'user',

	connection: 'redis',

	beforeCreate: function(values, next) {
		UserService.findByName(values.name).then(function(user) {
			if(user) {
				return next('Sorry, someone else already has that name!');
			}
		}, function(err) {
			return next(err);
		});

		return next();
	},

	attributes: {
		id: {
			type: 'integer',
			required: true,
			primaryKey: true
		},
		token: {
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
