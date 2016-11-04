(function() {
	'use strict';

	angular.module('courierChat').component('courierNav', getCourierNav());

	function getCourierNav() {
		return {
			templateUrl: 'app/components/courier-nav/courier-nav.html',
			controller: 'CourierNavController',
			bindings: {

			}
		};
	}
})();
