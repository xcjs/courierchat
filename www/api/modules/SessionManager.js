'use strict';

var Promise = require('node-promise').Promise;

module.exports = function(session, userModel) {
	var self = this;
	
	this.session = session;
	this.userModel = userModel;

	this.login = function() {
		return new Promise(function(resolve, reject) {
			if(!name) reject();

			userModel.findOne().where({ name: name }).then(function(user) {
				if(user) reject();

				userModel.create({
					name: name
				}).exec(function(err, user) {
					if(err === null) {
						self.session.user = user;
						self.session.authenticated = true;
						resolve(user);
					} else {
						reject(err);
					}
				});
			}).catch(function(err) {
				reject(err);
			});
		});
	};

	this.logout = function(name) {

	};

	var getUser = function() {

	}
};