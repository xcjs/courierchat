courierChat.factory('authInterceptor',
	['$rootScope', function($rootScope)	{
		return {
			request: function($config) {
				if($rootScope.user && $rootScope.user.token) {
					$config.headers['courierchat-auth-token'] = $rootScope.user.token;
				}

				return $config;
			}
		};
	}]);
