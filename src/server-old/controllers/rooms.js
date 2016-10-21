'use strict';

var express = require('express');
var RoomService = require('../services/RoomService.js');

var router = express.Router();
var path = '/api/rooms';

router.get(path, function(req, res) {
	var roomName = req.body.name;
	var roomModel = req.app.room;
	var service = new RoomService(roomModel);

	service.findByName(roomName).then(function(room) {
		res.json(room);
	}, function(err) {
		res.badRequest(err);
	});
});

module.exports = router;
