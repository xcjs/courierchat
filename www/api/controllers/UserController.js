/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

'use strict';

module.exports = {
	me: function(req, res) {
		if(req.session && req.session.user) {
			res.json(req.session.user);
		}
		else {
			res.forbidden();
		}
	},

	findOne: function(req, res) {

	},

	create: function(req, res) {
		var name = req.body.name;
		var mgr = new SessionService();

		mgr.login(name).then(function(user) {
			mgr.createSessionId(user).then(function(updatedUser) {
				user = updatedUser;
				res.set('CourierChat-Session-ID', user.sessionId);

				// Session ID is part of the header - it's not needed in the response body.
				delete user.sessionId;

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
		var mgr = new SessionService(req.session);

		mgr.logout().then(function() {
			  res.ok();
			}, function(err) {
			  res.forbidden({ error: err })
			}
		);
	}
};
