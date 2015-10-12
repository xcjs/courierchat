courierChat.service('userResource', ['$resource', '$rootScope', function($resource, $rootScope) {
	'use strict';

	this.login = function(username, success, failure) {
		userResource.save({ name: username }).$promise.then(success, failure);

	};

	this.logout = function(user, success, failure) {
		userResource.remove({ id: user.id }).$promise.then(success, failure);
	};
}]);
