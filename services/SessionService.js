'use strict';

var Q = require('q');
var config = require('../config.js');
var crypto = require('crypto');
var userService = require('./userService.js');

var sha1sum = crypto.createHash('sha1');

module.exports = function() {
	var self = this;

	this.login = function(name) {
    	return userService.create(name);
	};

	this.createSessionId = function(user) {
		sha1sum.update(config.security.secret + user.id);
		user.token = sha1sum.digest('hex');

		return userService.update(user);
	};

	this.logout = function(user) {
		var deferred = Q.defer();

		userService.removeByUser(user).then(function() {
			deferred.resolve();
		}, function() {
			deferred.reject('We had trouble logging you out. Please try again in a few minutes!');
		});

    	return deferred.promise;
	};
};
