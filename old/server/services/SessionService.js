'use strict';

var UserService = require('../services/UserService.js');
var Q = require('q');
var config = require('../config.js');
var crypto = require('crypto');

var sha1sum = crypto.createHash('sha1');

module.exports = function(userModel) {
	var service = new UserService(userModel);

	this.login = function(name) {
    	return service.create(name);
	};

	this.createSessionId = function(user) {
		sha1sum.update(config.security.secret + user.id);
		user.token = sha1sum.digest('hex');

		return service.update(user);
	};

	this.logout = function(user) {
		var deferred = Q.defer();

		service.removeByUser(user).then(function() {
			deferred.resolve();
		}, function() {
			deferred.reject('We had trouble logging you out. Please try again in a few minutes!');
		});

    	return deferred.promise;
	};
};
