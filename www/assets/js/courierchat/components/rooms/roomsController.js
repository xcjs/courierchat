courierChat.controller('roomsController', ['$scope', 'sessionService', function($scope, session) {
	'use strict';

	$scope.rooms = null;
	$scope.user = session.user;
}]);
