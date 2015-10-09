courierChat.service('userResource', ['$resource', function($resource) {
	'use strict';

	var userResource = $resource('/api/users/:id', { id: '@id' });

	this.keepaliveRoute = '/api/users/me';

	this.keepalive = function(success, failure) {
		userResource.get({ id: 'me' }).$promise.then(success, failure);
	};

	this.login = function(username, success, failure) {
		userResource.save({ name: username }).$promise.then(success, failure);
	};

	this.logout = function(user, success, failure) {
		userResource.remove({ id: user.id }).$promise.then(success, failure);
	};
}]);
