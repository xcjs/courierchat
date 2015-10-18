/**
 *
 * @param req An Express Request object.
 * @param res
 */
module.exports = function(req, res) {
	'use strict';

	var AUTH_TOKEN_HEADER = 'courierchat-auth-token';

	this.getAuthToken = function() {
		return req.get(AUTH_TOKEN_HEADER);
	};

	this.setAuthToken = function(token) {
		res.set(AUTH_TOKEN_HEADER, token);
	};
};
