(function() {
	'use strict';

	angular.module('courierChat').config(['$stateProvider', '$locationProvider', '$httpProvider',
		function($stateProvider, $locationProvider, $httpProvider) {
			$locationProvider.html5Mode(true);

			$httpProvider.interceptors.push('authInterceptor');

			$stateProvider
				.state('home', {
					url: '/',
					templateUrl: 'app/login/login.html',
					controller: 'LoginController',
					controllerAs: 'vm'
				})
				.state('login', {
					url: '/login',
					templateUrl: 'app/login/login.html',
					controller: 'loginController',
					controllerAs: 'vm'
				})
				.state('about',  {
					url: '/about',
					templateUrl: 'app/about/about.html',
					controllerAs: 'vm'
				})
				.state('rooms', {
					url: '/rooms',
					templateUrl: 'app/rooms/rooms.html',
					controller: 'roomsController',
					controllerAs: 'vm'
				});
		}]);
})();
