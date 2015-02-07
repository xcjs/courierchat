'use strict';

var courierChat = angular.module('courierChat', ['ui.router']);

courierChat.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
	var appBase = 'js/courierchat/';
	var templates = appBase + 'templates/';

	$locationProvider.html5Mode(true);

	$stateProvider
		.state('login', {
			url: '/',
			templateUrl: templates + 'login.html'
		})
		.state('about',  {
			url: '/about',
			templateUrl: templates + 'about.html'
	});
});