(function() {
	'use strict';

	angular.module('courierChat').service('environmentService', ['$location', function($location) {
		this.isLocal = function() {
			if($location.host === 'localhost') { return true; }
			return false;
		};

		this.getSocketProtocol = function() {
			if($location.protocol() === 'http') { return 'ws'; }
			return 'wss';
		};

	}]);
})();


