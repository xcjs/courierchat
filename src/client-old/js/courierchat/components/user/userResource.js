(function() {
	'use strict';

	angular.module('courierChat').service('userResource', ['$resource', function($resource) {
		var userResource = $resource('/api/users/:id', { id: '@id' });

		this.login = function(username, success, failure) {
			userResource.save({ name: username }).$promise.then(success, failure);
		};

		this.logout = function(user, success, failure) {
			userResource.remove({ id: user.id }).$promise.then(success, failure);
		};
	}]);
})();
