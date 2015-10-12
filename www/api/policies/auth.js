module.exports = function (req, res, next) {
	var authToken = req.header('courierchat-auth-token');

	if (!authToken) { return res.forbidden(); }

	UserService.findByToken(authToken).then(function(user) {
		if(user) {
			return next();
		}
	}, function(err) {
		return res.serverError(err);
	});
}
