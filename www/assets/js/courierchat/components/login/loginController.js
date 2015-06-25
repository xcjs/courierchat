courierChat.controller('loginController', ['$scope', '$state', 'userResource', 'sessionService', function($scope, $state, userResource, session) {
	'use strict';

	$scope.username = null;
	$scope.error = null;

	if(session.user !== null) $state.go('rooms');

	$scope.login = function() {
		if($scope.username === null || $scope.username.length === 0) {
			$scope.error = 'Wait a second, you still haven\'t introduced yourself.';
			return;
		}

		$scope.error = null;

		userResource.login($scope.username, function(user) {
			if(session.user === null) {
				session.user = user;
				$state.go('rooms');
			}
		}, function(response) {
			$scope.error = response.data.error;
		});
  	};
}]);
