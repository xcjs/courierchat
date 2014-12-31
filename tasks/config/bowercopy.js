module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-bowercopy');

	grunt.initConfig({
		bowercopy: {
	        options: {
	            
	        },
	        devScripts: {
	        	options: {
	        		srcPrefix: 'bower_components/',
	        		destPrefix: 'assets/js/vendor/'
	        	},
	        	files: {
	        		'console.js': 'html5-boilerplate/js/plugins.js',
	        		'lodash.js': 'lodash/dist/lodash.js',
	        		'angular.js': 'angular/angular.js',
	        		'angular-animate.js': 'angular-animate/angular-animate.js',
	        		'angular-cookies.js': 'angular-cookies/angular-cookies.js',
	        		'angular-resource.js': 'angular-resource/angular-resource.js',
	        		'angular-route.js': 'angular-route/angular-route.js',
	        		'ngsails.io.js': 'angularSails/dist/ngsails.io.js',
	        		'modernizr.js': 'modernizr/modernizr.js'
	        	}   
	        },
	        devStylesheets: {
	        	options: {
	        		srcPrefix: 'bower_components/',
	        		destPrefix: 'assets/styles/vendor/'
	        	},
	        	files: {
	        		'normalize.css': 'html5-boilerplate/css/normalize.css',
	        		'animate.css': 'animate.css/animate.css'
	        	}
	        }
	    }
	});
};