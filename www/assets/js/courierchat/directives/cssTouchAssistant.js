angular.module('cssTouchAssistant', [])
.directive('endTouchFocus', [function() {
	var endTouch = function(scope, e, attrs) {
		e.on({'touchend': function() {
			this.blur();
		}});
	};

	return {
		restrict: 'A',
		link: endTouch
	};
}]);