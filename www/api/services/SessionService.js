'use strict';

var Q = require('q');
var UserFactory = require('./UserFactoryService.js');

module.exports = function(session) {
	var self = this;

	this.session = session;

	this.login = function(name) {
    return UserFactory.findByName(name);
	};

	this.logout = function(name) {
    var deferred = Q.defer();

    if(name === self.session.user.name) {
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
