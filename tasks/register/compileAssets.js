module.exports = function (grunt) {
	grunt.registerTask('compileAssets', [
		'clean:dev',
		'bowercopy',
		'jst:dev',
		'less:dev',
		'copy:dev',
		'coffee:dev'
	]);
};
