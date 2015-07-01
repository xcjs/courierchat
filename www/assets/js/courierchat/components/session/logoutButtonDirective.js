courierChat.directive('logoutButton', ['$rootScope', '$state', 'sessionService', 'userResource', function($rootScope, $state, sessionService, userResource) {
	var link = function(scope, elem, attrs) {
		if(!sessionService.user) {
			elem.css('display', 'none');
		}

		$rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){
			if(!sessionService.user) {
				elem.css('display', 'none');
			}
			else {
				elem.css('display', 'block');
			}
		});
	};

	var controller = function($scope) {
		$scope.logout = function() {
			userResource.logout(sessionService.user, function() {
				sessionService.user = null;
				sessionService.room = null;

				$state.go('login');
			}, function() {

			});
		};
	};

	return {
		restrict: 'E',
		replace: 'true',
		scope: true,
		link: link,
		controller: controller,
		template:
			'<li>\
				<a ng-click="logout()">\
					<img src="/images/logout.svg" alt="Courier Chat Logo">\
					<span class="animated faster anim-nav-hover shadowed">\
						Log Out\
					</span>\
				</a>\
			</li>'
	};
}]);
