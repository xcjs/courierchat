/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

'use strict';

var SessionManager = require('../modules/SessionManager.js');
var User = require('../models/User.js');

module.exports = {
	findOne: function(req, res) {

	},

	create: function(req, res) {
		var name = req.param('name');
		var mgr = new SessionManager(req.session, User);

		mgr.login(name).then(function(user) {
			res.json(user);
		}, function(err) {
			res.badRequest('err');
		});
	},

	update: function(req, res) {

	},

	destroy: function(req, res) {

	}
};