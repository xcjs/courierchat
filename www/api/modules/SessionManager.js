'use strict';

var Q = require('q');

module.exports = function(session) {
	var self = this;
	
	this.session = session;

	this.login = function(name) {
        var deferred = Q.defer();

        User.findOne({ name: name }).exec(function(err, user) {
            if(user) {
                deferred.reject('You can\'t take a name already in use.');
                return;
            }
            if(err) {
                deferred.reject(err);
                return;
            }

            User.create({ name: name }).exec(function(err, user) {
                if(err) {
                    deferred.reject(err);
                }
                deferred.resolve(user);
            });
        });

        return deferred.promise;
	};

	this.logout = function(name) {

	};

	var getUser = function() {

	}
};