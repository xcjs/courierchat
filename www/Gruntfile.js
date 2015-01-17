/**
 * Gruntfile
 *
 * This Node script is executed when you run `grunt` or `sails lift`.
 * It's purpose is to load the Grunt tasks in your project's `tasks`
 * folder, and allow you to add and remove tasks as you see fit.
 * For more information on how this works, check out the `README.md`
 * file that was generated in your `tasks` folder.
 *
 * WARNING:
 * Unless you know what you're doing, you shouldn't change this file.
 * Check out the `tasks` directory instead.
 */

module.exports = function(grunt) {
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
	        		'main.css': 'html5-boilerplate/css/main.css',
	        		'animate.css': 'animate.css/animate.css'
	        	}
	        }
	    }
	});	

	// Load the include-all library in order to require all of our grunt
	// configurations and task registrations dynamically.
	var includeAll;
	try {
		includeAll = require('include-all');
	} catch (e0) {
		try {
			includeAll = require('sails/node_modules/include-all');
		}
		catch(e1) {
			console.error('Could not find `include-all` module.');
			console.error('Skipping grunt tasks...');
			console.error('To fix this, please run:');
			console.error('npm install include-all --save`');
			console.error();

			grunt.registerTask('default', []);
			return;
		}
	}


	/**
	 * Loads Grunt configuration modules from the specified
	 * relative path. These modules should export a function
	 * that, when run, should either load/configure or register
	 * a Grunt task.
	 */
	function loadTasks(relPath) {
		return includeAll({
			dirname: require('path').resolve(__dirname, relPath),
			filter: /(.+)\.js$/
		}) || {};
	}

	/**
	 * Invokes the function from a Grunt configuration module with
	 * a single argument - the `grunt` object.
	 */
	function invokeConfigFn(tasks) {
		for (var taskName in tasks) {
			if (tasks.hasOwnProperty(taskName)) {
				tasks[taskName](grunt);
			}
		}
	}




	// Load task functions
	var taskConfigurations = loadTasks('./tasks/config'),
		registerDefinitions = loadTasks('./tasks/register');

	// (ensure that a default task exists)
	if (!registerDefinitions.default) {
		registerDefinitions.default = function (grunt) { grunt.registerTask('default', []); };
	}

	// Run task functions to configure Grunt.
	invokeConfigFn(taskConfigurations);
	invokeConfigFn(registerDefinitions);

};
