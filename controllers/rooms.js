'use strict';

var express = require('express');
var roomService = require('../services/roomService.js');

var router = express.Router();
var path = '/api/rooms';

router.get(path, function(req, res) {
	var roomName = req.body.name;

	roomService.findByName(roomName).then(function(room) {
		res.json(room);
	}, function(err) {
		res.badRequest(err);
	});
});

module.exports = router;
