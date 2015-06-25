courierChat.service('userResource', [
'$resource', 'sessionFactory',
function($resource, sessionFactory) {
	'use strict';

	var userResource = $resource('/api/users/:id', { id: '@id' });

	this.login = function(username, success, failure) {
		userResource.save({ name: username }, success, failure);
	};
}]);
