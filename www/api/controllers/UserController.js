/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

'use strict';

module.exports = {
	findOne: function(req, res) {
    	var name = req.param('id');
    	if(name !== req.session.user.name) res.forbidden();

		res.json(req.session.user);
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
		var name = req.param('id');
		var mgr = new SessionService(req.session);

		mgr.logout(name).then(function() {
			  res.ok();
			}, function(err) {
			  res.forbidden({ error: err })
			}
		);
	}
};
