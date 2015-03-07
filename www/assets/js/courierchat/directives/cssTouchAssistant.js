angular.module('cssTouchAssistant', [])
.directive('endTouchFocus', ['$window', function($window) {
	var endTouch = function(scope, e, attrs) {
		e.on('click', function() {
			var touchedElement = angular.element(this);
			var parent = touchedElement.parent();
			var timeoutCount = 3000;

			touchedElement.css("animation-play-state", "paused");
			touchedElement.children().css("animation-play-state", "paused");
			touchedElement[0].blur();
			$window.setTimeout(function() { touchedElement.css("animation-play-state", "running"); touchedElement.children().css("animation-play-state", "running"); }, timeoutCount);
		});
	};

	return {
		restrict: 'A',
		link: endTouch
	};
}]);