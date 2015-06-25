var courierChat = angular.module('courierChat', ['ui.router', 'ngResource']);

courierChat.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
	'use strict';

	var appBase = 'js/courierchat/';
	var templates = appBase + 'templates/';

	$locationProvider.html5Mode(true);

	$stateProvider
	.state('home', {
		url: '/',
		templateUrl: templates + 'login.html',
  		controller: 'loginController'
	})
    .state('login', {
  		url: '/login',
  		templateUrl: templates + 'login.html',
  		controller: 'loginController'
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
