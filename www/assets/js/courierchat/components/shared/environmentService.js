courierChat.service('environmentService', ['$location', function($location) {
	'use strict';

	this.isLocal = function() {
		if($location.host === 'localhost') return true;
		return false;
	};

	this.getSocketProtocol = function() {
		if($location.protocol() === 'http') return 'ws';
		return 'wss';
	};

}]);
