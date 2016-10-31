(function () {
	'use strict';

	angular.module('courierChat').controller('loginController',
		['$rootScope', '$scope', '$state', 'userResource',
		function ($rootScope, $scope, $state, userResource) {
			$rootScope.title = 'Login - CourierChat';

			$scope.username = null;
			$scope.error = null;

			$scope.login = login;

			onLoad();

			function onLoad() {
				if ($rootScope.user) {
					$state.go('rooms');
				}
			}

			function login() {
				if ($scope.username === null || $scope.username.length === 0) {

					$scope.error = 'Wait a second, you still haven\'t introduced yourself.';
					return;
				}

				$scope.error = null;

				userResource.login($scope.username,
					function (user) {
						$rootScope.user = user;
						$state.go('rooms');
					},
					function (response) {
						$scope.error = response.data.error;
					}
				);
			}
		}]
	);
})();
