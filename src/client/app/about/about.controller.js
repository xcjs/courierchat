(function() {
	'use strict';

	angular.module('courierChat').controller('AboutController', AboutController);

	function AboutController($rootScope) {
		onLoad();

		function onLoad() {
			$rootScope.title = 'About - CourierChat';
		}
	}
})();
