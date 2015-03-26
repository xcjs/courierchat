'use strict';

var UserModel = require('../models/User.js');

module.exports = function(session) {
	var self = this;
	var authenticated = session.authenticated = false;
	var user = session.user = null;	

	this.login = function(name) {
		var searchedUser = null;

		if(!name) return false;

		UserModel.find().where({ name: name }).then(function(user) {
			searchedUser = user;
		}).catch(function(err) {
			// TODO: Log error.
		});

		if(searchedUser) return false;

		UserModel.create({
			name: name
		}).exec(function(err, user) {
			if(err === null) {
				self.user = user;
				self.authenticated = true;
			}
		});

		return self.authenticated;
	};

	this.logout = function(name) {

	};

	var getUser = function() {

	}
};