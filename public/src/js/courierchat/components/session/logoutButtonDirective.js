courierChat.directive('logoutButton', ['$rootScope', '$state', 'sessionService', 'userResource', function($rootScope, $state, sessionService, userResource) {
	var link = function(scope, elem, attrs) {
		if(!sessionService.user) {
			elem.css('display', 'none');
		}

		$rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){
			if(!$rootScope.user) {
				elem.css('display', 'none');
			}
			else {
				elem.css('display', 'block');
			}
		});
	};

	var controller = ['$scope', function($scope) {
		$scope.logout = function() {
			userResource.logout($rootScope.user, function() {
				$rootScope.user = null;
				$rootScope.room = null;

				$state.go('login');
			}, function() {

			});
		};
	}];

	return {
		restrict: 'E',
		replace: 'true',
		scope: true,
		link: link,
		controller: controller,
		template: 'logoutButton.html'
	};
}]);
