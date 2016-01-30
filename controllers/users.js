'use strict';

var express = require('express');
var SessionService = require('../services/SessionService.js');
var HeaderService = require('../services/HeaderService.js');

var router = express.Router();
var path = '/api/users';

router.post(path, function(req, res) {
	var name = req.body.name;
	var sessionMgr = new SessionService(req.app.models.user);
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
});

router.delete(path, function(req, res) {
	var headerMgr = new HeaderService(req, res);
	var token = headerMgr.getAuthToken();

	var sessionMgr = new SessionService();

	userService.findByToken(token).then(function(user) {
		sessionMgr.logout(user).then(function() {
				res.ok();
			}, function(err) {
				res.forbidden({ error: err });
			}
		);
	}, function(err) {
		res.serverError({ error: err });
	});
});

module.exports = router;
