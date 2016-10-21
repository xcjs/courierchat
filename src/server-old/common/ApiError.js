'use strict';

var ApiError = function(message) {
	var errorResponse = {
		errors: []
	};

	this.add = function(message) {
		switch(typeof message) {
			case 'string':
				errorResponse.errors.push(message);
				break;
			case 'array':
				errorResponse.errors = errorResponse.errors.concat(message);
				break;
			case 'object':
				if(message.error || message.errors) {
					this.add(message.error || message.errors);
				} else {
					errorResponse.errors.push('An unspecified error occurred.');
				}
				break;
			default:
				errorResponse.errors.push('An unspecified error occurred.');
				break;
		}
	};

	this.add(message);

	this.response = errorResponse;
};

module.exports = ApiError;
