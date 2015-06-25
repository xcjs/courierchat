var courierChat = angular.module('courierChat', ['ui.router', 'ngResource']);

courierChat.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
	'use strict';

	var appBase = '/js/courierchat/';
	var components = appBase + 'components/';

	$locationProvider.html5Mode(true);

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
  	})
});
