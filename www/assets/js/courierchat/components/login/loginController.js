courierChat.controller('loginController', ['$scope', 'user', function($scope, user) {
	'use strict';

	$scope.username = null;
	$scope.error = null;

	$scope.login = function() {
		if($scope.username === null || $scope.username.length === 0) {
			$scope.error = 'What should we call you?';
			return;
		}

		$scope.error = null;

		var chatter = new user();
		chatter.name = $scope.username;
  	};
}]);
