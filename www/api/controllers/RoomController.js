/**
 * RoomController
 *
 * @description :: Server-side logic for managing Rooms
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {
	create: function(req, res) {
		var roomName = req.body.name;

		RoomFactoryService.findByName(roomName).then(function(room) {
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
