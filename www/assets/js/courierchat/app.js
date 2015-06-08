var courierChat = angular.module('courierChat', ['ui.router']);

courierChat.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
	var appBase = 'js/courierchat/';
	var templates = appBase + 'templates/';

	$locationProvider.html5Mode(true);

	$stateProvider
		.state('home', {
			url: '/',
			templateUrl: templates + 'login.html',
      controller: 'userController'
		})
    .state('login', {
      url: '/login',
      templateUrl: templates + 'login.html',
      controller: 'userController'
    })
		.state('about',  {
			url: '/about',
			templateUrl: templates + 'about.html'
	  })
    .state('rooms', {
      url: '/rooms',
      templateUrl: templates + 'rooms.html'
  })
});
