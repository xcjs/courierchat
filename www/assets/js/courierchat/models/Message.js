courierChat.factory('message', [function() {
	return function() {
		this.id = 0;
		this.messages = null;
		this.timestamp = null;
		this.user = null;
		this.room = null;
	};
}]);