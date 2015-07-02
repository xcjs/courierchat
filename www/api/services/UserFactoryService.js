'use strict';

var Q = require('q');

module.exports = {
	findByName: function (name) {
		var deferred = Q.defer();

		if (name === null || name === undefined) {
			deferred.reject('What are we supposed to name you?');
			return deferred.promise;
		}

		User.findOne({name: name}).exec(function (err, user) {
			if (user) {
				deferred.reject('Sorry, someone already claimed that name!');
				return;
			}
			if (err) {
				deferred.reject(err);
				return;
			}

			User.create({name: name}).exec(function (err, user) {
				if (err) {
					deferred.reject(err);
				}
				deferred.resolve(user);
			});
		});

		return deferred.promise;
	},

	removeByUser: function (user) {
		var deferred = Q.defer();

		User.destroy({id: user.id}).exec(function (err) {
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
