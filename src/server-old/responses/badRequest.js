'use strict';

var ApiError = require('../common/ApiError.js');

var badRequest = function(body) {
	var error = new ApiError(body);

	this.set('Content-Type', 'application/json');
	this.status(400);

	this.json(error.response);
};

module.exports = badRequest;
