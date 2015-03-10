/**
 * UserController
 *
 * @description :: Server-side logic for managing Users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {
	create: function(req, res) {
		var name = req.param('name');
		User.create({
			name: name
		}).exec(function(err, user) {
			res.json(user);
			req.session.userId = user.id;
		});
	}
};