(function () {
	'use strict';

	angular.module('courierChat').controller('LoginController', LoginController);

	function LoginController($rootScope, $state, userResource) {
		var vm = this;

		vm.username = null;
		vm.error = null;

		vm.login = login;

		onLoad();

		function onLoad() {
			$rootScope.title = 'Login - CourierChat';

			if ($rootScope.user) {
				$state.go('rooms');
			}
		}

		function login() {
			if (vm.username === null || vm.username.length === 0) {

				vm.error = 'Wait a second, you still haven\'t introduced yourself.';
				return;
			}

			vm.error = null;

			userResource.login(vm.username,
				function (user) {
					$rootScope.user = user;
					$state.go('rooms');
				},
				function (response) {
					vm.error = response.data.error;
				}
			);
		}
	}
})();
