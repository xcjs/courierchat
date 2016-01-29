'use strict';

var Q = require('q');
var stringService = require('./stringService.js');
var user = require('../models/user.js');

module.exports = {
	create: function(name) {
		var deferred = Q.defer();

		if(!stringService.hasValue(name)) {
			deferred.reject('Sorry, that name isn\'t going to work for us.');
			return deferred.promise;
		}

		user.create({ name: name }).exec(function (err, user) {
			if (!err) {
				deferred.resolve(user);
			} else {
				deferred.reject(err);
			}
		});

		return deferred.promise;
	},

	findByName: function (name) {
		var deferred = Q.defer();

		if (!stringService.hasValue(name)) {
			deferred.reject('A valid name is required to find a user.');
			return deferred.promise;
		}

		user.findOne({name: name}).exec(function (err, user) {
			if (!err) {
				deferred.resolve(user);
			}
			else {
				deferred.reject(err);
			}
		});

		return deferred.promise;
	},

	findByToken: function(authToken) {
		var deferred = Q.defer();

		if(!stringService.hasValue(authToken)) {
			deferred.reject('A valid token was not provided, so you cannot be logged out.');
			return deferred.promise;
		};

		user.findOne({token: authToken}).exec(function(err, user) {
			if (!err) {
				deferred.resolve(user);
			} else {
				deferred.reject(err);
			}
		});

		return deferred.promise;
	},

	update: function(user) {
		var deferred = Q.defer();

		user.update({ id: user.id }, user).exec(function(err, users) {
			if(!err && users.length > 0) {
				deferred.resolve(users[0]);
			}
			else if(err) {
				deferred.reject(err);
			}
			else {
				deferred.reject('A matching user could not be found to update based on the information provided.');
			}
		});

		return deferred.promise;
	},

	removeByUser: function (user) {
		var deferred = Q.defer();

		user.destroy({id: user.id}).exec(function (err) {
			if (!err) {
				deferred.resolve();
			}
			else {
				deferred.reject(err);
			}
		});

		return deferred.promise;
	}
};
