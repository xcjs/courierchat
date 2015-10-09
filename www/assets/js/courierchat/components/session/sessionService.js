courierChat.service('sessionService', ['userResource', function(userResource) {
	'use strict';

	var self = this;

	this.user = null;
	this.room = null;
	this.sessionSocket = null;
	this.roomSocket = null;

	this.createSessionSocket = function() {
		var socketRoute = userResource.keepaliveRoute;
	};
}]);
