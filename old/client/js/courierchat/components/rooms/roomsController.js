(function() {
	'use strict';

	angular.module('courierChat').controller('roomsController',
		['$rootScope', '$scope',
		function($rootScope, $scope) {

		$scope.rooms = null;
		$scope.user = $rootScope.user;
	}]);
})();

