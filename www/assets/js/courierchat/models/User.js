courierChat.factory('user', [function() {
	return function() {
		this.id = 0;
		this.name = null;
		this.room = null;
		this.creator = false;
		this.messages = new Array();
	};
}]);