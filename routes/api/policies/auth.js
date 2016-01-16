module.exports = function (req, res, next) {
	'use strict';

	var headerMgr = new HeaderService(req, res);
	var authToken = headerMgr.getAuthToken();

	if (!authToken) { return res.forbidden(); }

	UserService.findByToken(authToken).then(function(user) {
		if(user) { return next(); }
		else { res.serverError('Unable to properly authenticate due to missing user record.'); }
	}, function(err) {
		return res.serverError(err);
	});
}
