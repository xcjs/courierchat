angular.module('cssTouchAssistant', [])
.directive('endTouchFocus', ['$window', function($window) {
	var endTouch = function(scope, e, attrs) {
		e[0].addEventListener('touchend', function() {
			var touchedElement = angular.element(this);
			var parent = touchedElement.parent();

			
			$window.setTimeout(function() {
				touchedElement.remove(); 				
				parent.append(touchedElement);
			}, 
			2000);
		}, true);
	};

	return {
		restrict: 'A',
		link: endTouch
	};
}]);