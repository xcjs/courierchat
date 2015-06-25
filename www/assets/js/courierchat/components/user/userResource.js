courierChat.service('userResource', ['$resource', function($resource) {
	'use strict';

	var userResource = $resource('/api/users/:id', { id: '@id' });

	this.login = function(username, success, failure) {
		userResource.save({ name: username }, success, failure);
	};
}]);
