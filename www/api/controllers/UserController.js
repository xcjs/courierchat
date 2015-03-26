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

	},

	create: function(req, res) {
		var name = req.param('name');
		var mgr = new SessionManager(req.session);

		if(mgr.login(name)) {
			res.json(mgr.user);
		}
		else {
			res.badRequest('Sorry, that user name is taken.');
		}
	},

	update: function(req, res) {

	},

	destroy: function(req, res) {

	}
};