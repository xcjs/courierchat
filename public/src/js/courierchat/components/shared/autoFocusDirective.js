(function() {
	'use strict';

	angular.module('courierChat').directive('autoFocus', function() {
		return {
			link: {
				post: function postLink(scope, element) {
					element[0].focus();
				}
			}
		};
	});
})();
