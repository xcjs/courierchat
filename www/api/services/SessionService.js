'use strict';

var Q = require('q');
var crypto = require('crypto');
var sha1sum = crypto.createHash('sha1');

module.exports = function() {
	var self = this;

	this.login = function(name) {
    	return UserService.create(name);
	};

	this.createSessionId = function(user) {
		sha1sum.update(sails.config.session.secret + user.id);
		user.token = sha1sum.digest('hex');

		return UserService.update(user);
	};

	this.logout = function(user) {
		var deferred = Q.defer();

		UserService.removeByUser(user).then(function() {
			deferred.resolve();
		}, function() {
			deferred.reject('We had trouble logging you out. Please try again in a few minutes!');
		});

    	return deferred.promise;
	};
};
