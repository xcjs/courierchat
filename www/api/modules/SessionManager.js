'use strict';

var Q = require('q');
var UserFactory = require('./UserFactory.js');

module.exports = function(session) {
	var self = this;

	this.session = session;

	this.login = function(name) {
    return UserFactory.findByName(name);
	};

	this.logout = function(name) {

	};

	var getUser = function() {

	}
};
