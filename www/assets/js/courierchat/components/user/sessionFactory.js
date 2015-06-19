courierChat.factory('sessionFactory', [function() {
	'use strict';

	var session = function() {
		this.user = null;
		this.room = null;
	};

	var currentSession = new session();

	return currentSession;
}]);
