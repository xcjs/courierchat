module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-bowercopy');

	grunt.initConfig({
		bowercopy: {
	        options: {
	            
	        },
	        scripts: {
	        	options: {
	        		srcPrefix: 'bower_components/',
	        		destPrefix: 'assets/js/vendor/'
	        	},
	        	files: {
	        		'angular.min.js': 'angular/angular.min.js'
	        	}   
	        },
	        stylesheets: {
	        	options: {
	        		srcPrefix: 'bower_components/',
	        		destPrefix: 'assets/css/vendor/'
	        	},
	        	files: {
	        		'animate.min.css': 'animate.css/animate.min.css'
	        	}
	        }
	    }
	});
};