(function() {
	'use strict';

	angular.module('courierChat').config(['$stateProvider', '$locationProvider', '$httpProvider',
		function($stateProvider, $locationProvider, $httpProvider) {

			var appBase = '/js/courierchat/';
			var components = appBase + 'components/';

			$locationProvider.html5Mode(true);

			$httpProvider.interceptors.push('authInterceptor');

			$stateProvider
				.state('home', {
					url: '/',
					templateUrl: components + 'login/login.html',
					controller: 'loginController'
				})
				.state('login', {
					url: '/login',
					templateUrl: components + 'login/login.html',
					controller: 'loginController'
				})
				.state('about',  {
					url: '/about',
					templateUrl: components + 'about/about.html'
				})
				.state('rooms', {
					url: '/rooms',
					templateUrl: components + 'rooms/rooms.html',
					controller: 'roomsController'
				});
		}]);
})();