/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

'use strict';

module.exports = {
	findOne: function(req, res) {

	},

	create: function(req, res) {
		var name = req.body.name;
		var sessionMgr = new SessionService();
		var headerMgr = new HeaderService(req, res);

		sessionMgr.login(name).then(function(user) {
			sessionMgr.createSessionId(user).then(function(updatedUser) {
				user = updatedUser;
				headerMgr.setAuthToken(user.token);

				res.json(user);
			}, function(err) {
				res.serverError({ error: err });
			});
		}, function(err) {
			res.badRequest({ error: err });
		});
	},

	update: function(req, res) {

	},

	destroy: function(req, res) {
		var headerMgr = new HeaderService(req, res);
		var token = headerMgr.getAuthToken();

		var sessionMgr = new SessionService();

		UserService.findByToken(token).then(function(user) {
			sessionMgr.logout(user).then(function() {
					res.ok();
				}, function(err) {
					res.forbidden({ error: err });
				}
			);
		}, function(err) {
			res.serverError({ error: err });
		});
	}
};
