'use strict';

module.exports = {
	hasValue: function(stringValue) {
		if (stringValue === null || stringValue === undefined || stringValue === '') {
			return false;
		}

		return true;
	}
};
