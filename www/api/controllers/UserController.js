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
		var mgr = new SessionService(req.session);

		mgr.login(name).then(function(user) {
		  		req.session.user = user;
				res.json(user);
			}, function(err) {
				res.badRequest({ error: err });
			}
		);
	},

	update: function(req, res) {

	},

	destroy: function(req, res) {
		var id = parseInt(req.param('id'));
		var mgr = new SessionService(req.session);

		mgr.logout(id).then(function() {
			  res.ok();
			}, function(err) {
			  res.forbidden({ error: err })
			}
		);
	}
};
