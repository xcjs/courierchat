(function() {
	'use strict';

	angular.module('courierChat').controller('CourierNavController', CourierNavController);

	function CourierNavController($rootScope, $state, userResource) {
		var self = this;

		self.user = $rootScope.user;
		self.logout = logout();

		function logout() {
			userResource.logout($rootScope.user, function() {
				$rootScope.user = null;
				$rootScope.room = null;

				$state.go('login');
			});
		}
	}
})();
