/**
 * RoomController
 *
 * @description :: Server-side logic for managing Rooms
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

var RoomFactory = require('../modules/RoomFactory.js');

module.exports = {
	create: function(req, res) {
		var roomName = req.body.name;
		var roomFactory = RoomFactory;

		roomFactory.findByName(roomName).then(function(room) {
			res.json(room);
		}, function(err) {
			res.badRequest(err);
		});
	},

	update: function(req, res) {

	},

	destroy: function(req, res) {

	}
};
