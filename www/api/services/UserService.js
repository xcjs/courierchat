'use strict';

var Q = require('q');

var validName = function(name) {
	if (name === null || name === undefined || name === '') {
		return false;
	}

	return true;
};

module.exports = {
	create: function(name) {
		var deferred = Q.defer();

		if(!validName(name)) {
			deferred.reject('Sorry, that name isn\'t going to work for us.');
			return deferred.promise;
		}

		User.create({ name: name }).exec(function (err, user) {
			if (err) {
				deferred.reject(err);
				return deferred.promise;
			}

			deferred.resolve(user);
		});

		return deferred.promise;
	},

	findByName: function (name) {
		var deferred = Q.defer();

		if (!validName(name)) {
			deferred.reject('A valid name is required to find a user.');
			return deferred.promise;
		}

		User.findOne({name: name}).exec(function (err, user) {
			if (user) {
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

		User.findOne({token: authToken}).exec(function(err, user) {
			if (!err) {
				deferred.resolve(user);
			} else {
				deferred.reject(err);
			}
		});

		return deferred;
	},

	update: function(user) {
		var deferred = Q.defer();

		User.update({ id: user.id }, user).exec(function(err, users) {
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

		User.destroy({id: user.id}).exec(function (err) {
			if (err) {
				deferred.reject(err);
			}
			else {
				deferred.resolve();
			}
		});

		return deferred.promise;
	}
};
