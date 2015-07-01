'use strict';

var Q = require('q');
var UserFactory = require('./UserFactoryService.js');

module.exports = function(session) {
	var self = this;

	this.session = session;

	this.login = function(name) {
    	return UserFactory.findByName(name);
	};

	this.logout = function(id) {
		var deferred = Q.defer();

		// Take care of cases where the client becomes de-synchronized with the server.
		if(!self.session || !self.session.user) {
			deferred.resolve();
		}
		else if(id === self.session.user.id) {
		  UserFactory.removeByUser(self.session.user).then(function() {
			self.session.destroy();
			deferred.resolve();
		  }, function() {
			deferred.reject('We had trouble logging you out. Please try again in a few minutes!');
		  });
		}
		else {
		  deferred.reject('You can\'t log out as another user.');
		}

    	return deferred.promise;
	};
};
