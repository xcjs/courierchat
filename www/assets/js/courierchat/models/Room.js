courierChat.factory('room', [function() {
	return function() {
		this.id = 0;
		this.name = null;
		this.creationDate = null;
		this.owner = null;
		this.users = new Array();
		this.messages = new Array();
	};
}]);