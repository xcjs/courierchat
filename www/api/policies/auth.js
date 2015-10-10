module.exports = function (req, res, next) {
	var authToken = req.header('courierchat-auth-token');

	if (!authToken) { return res.forbidden(); }

	User.findOne({token: authToken}).exec(function(err, user) {
		if (err) { return next(err); }
		if (!user) { return res.forbidden(); }

		return next();
	});
}
