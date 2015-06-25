courierChat.controller('loginController', ['$scope', 'userResource', 'sessionService', function($scope, userResource, session) {
	'use strict';

	$scope.username = null;
	$scope.error = null;

	$scope.login = function() {
		if($scope.username === null || $scope.username.length === 0) {
			$scope.error = 'Wait a second, you still haven\'t introduced yourself.';
			return;
		}

		$scope.error = null;

		userResource.login($scope.username, function(user) {
			if(session.user === null) {
				session.user = user;
			}
		}, function(response) {
			$scope.error = response.data.error;
		});
  	};
}]);
