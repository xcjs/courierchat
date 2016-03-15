courierChat.directive('autoFocus', function() {
	return {
		link: {
			post: function postLink(scope, element, attr) {
				element[0].focus();
			}
		}
	};
});
