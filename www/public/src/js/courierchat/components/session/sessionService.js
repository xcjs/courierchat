courierChat.service('sessionService', ['userResource', function(userResource) {
	'use strict';

	var self = this;

	this.user = null;
	this.room = null;
	this.sessionSocket = null;
	this.roomSocket = null;

	this.checkSession = function() {
		var socketRoute = userResource.keepaliveRoute;
	};
}]);
