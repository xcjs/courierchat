'use strict';

var gulp = require('gulp'),
	concat = require('gulp-concat'),
	cssnano = require('gulp-cssnano'),
	del = require('del'),
	filter = require('gulp-filter'),
	htmlmin = require('gulp-htmlmin'),
	imagemin = require('gulp-imagemin'),
	mainBowerFiles = require('gulp-main-bower-files'),
	pngquant = require('imagemin-pngquant'),
	sourcemaps = require('gulp-sourcemaps'),
	uglify = require('gulp-uglify'),
	watch = require('gulp-watch');

gulp.task('default', ['build']);

gulp.task('build', ['clean', 'minHtml', 'minCss', 'minJs', 'minImages']);

gulp.task('clean', function(cb) {
	del.sync(['public/dist'], cb);
});

gulp.task('watch', function() {
	watch('public/src/**/*.*', function () {
		gulp.start('build');
	});
});

gulp.task('minHtml', function() {
	return gulp.src('public/src/**/*.html')
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(gulp.dest('public/dist'));
});

gulp.task('minCss', ['minVendorCss', 'minAppCss']);

gulp.task('minVendorCss', function() {
	var cssFilter = filter('**/*.css');

	return gulp.src('./bower.json')
		.pipe(mainBowerFiles())
		.pipe(cssFilter)
		.pipe(sourcemaps.init())
		.pipe(concat('vendor.css'))
		.pipe(cssnano())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public/dist/css'));
});

gulp.task('minAppCss', function() {
	return gulp.src('public/src/css/**/*.css')
		.pipe(sourcemaps.init())
		.pipe(cssnano())
		.pipe(concat('app.css'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public/dist/css'));
});

gulp.task('minJs', ['minVendorJs', 'minAppJs']);

gulp.task('minVendorJs', function() {
	var jsFilter = filter(['**/angular.js', '**/*.js']);

	return gulp.src('./bower.json')
		.pipe(mainBowerFiles())
		.pipe(jsFilter)
		.pipe(sourcemaps.init())
		.pipe(concat('vendor.js'))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public/dist/js'));
});

gulp.task('minAppJs', function() {
	return gulp.src('public/src/js/**/*.js')
		.pipe(sourcemaps.init())
		.pipe(concat('app.js'))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public/dist/js'));
});

gulp.task('minImages', function() {
	return gulp.src('public/src/images/*')
		.pipe(imagemin({
			// JPG
			progressive: true,
			// PNG
			optimizationLevel: 4,
			use: [pngquant()],
			// SVG
			multipass: true,
			svgoPlugins: [{ removeViewBox: false }]
		}))
		.pipe(gulp.dest('public/dist/images'));
});
