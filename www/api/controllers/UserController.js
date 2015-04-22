/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

'use strict';

var SessionManager = require('../modules/SessionManager.js');

module.exports = {
	findOne: function(req, res) {
    var name = req.param('id');
    if(name !== req.session.user.name) res.forbidden();

    res.json(req.session.user);
	},

	create: function(req, res) {
		var name = req.body.name;
		var mgr = new SessionManager(req.session);

		mgr.login(name).then(function(user) {
      req.session.user = user;
			res.json(user);
		}, function(err) {
			res.badRequest(err);
		});
	},

	update: function(req, res) {

	},

	destroy: function(req, res) {
    var id = req.body.name;
	}
};
