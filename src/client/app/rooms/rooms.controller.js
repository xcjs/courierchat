(function() {
	'use strict';

	angular.module('courierChat').controller('RoomsController', RoomsController);

	function RoomsController($rootScope) {
		var vm = this;

		vm.rooms = null;
		vm.user = $rootScope.user;
	}
})();
