'use strict';

var gulp = require('gulp'),
	concat = require('gulp-concat'),
	cssnano = require('gulp-cssnano'),
	del = require('del'),
	filter = require('gulp-filter'),
	htmlmin = require('gulp-htmlmin'),
	imagemin = require('gulp-imagemin'),
	install = require('gulp-install'),
	mainBowerFiles = require('gulp-main-bower-files'),
	pngquant = require('imagemin-pngquant'),
	sourcemaps = require('gulp-sourcemaps'),
	uglify = require('gulp-uglify'),
	watch = require('gulp-watch');

gulp.task('default', ['build']);

gulp.task('build', ['clean', 'minHtml', 'minCss', 'minJs', 'minImages']);

gulp.task('install', function() {
	gulp.src(['./bower.json', './package.json'])
		.pipe(install());
});

gulp.task('clean', function(cb) {
	del.sync(['public/dist', 'public/src/css/vendor', 'public/src/js/vendor'], cb);
});

gulp.task('watch', ['build', 'registerWatchTasks']);

gulp.task('registerWatchTasks', function() {
	watch('./Gulpfile.js', function() {
		gulp.start('build');
	});

	watch('public/src/js/**/*.html', function() {
		gulp.start('minHtml');
	});

	watch('bower_components/**/*.css', function() {
		gulp.start('minVendorCss');
	});

	watch('public/src/css/**/*.css', function() {
		gulp.start('minAppCss');
	});

	watch('bower_components/**/*.js', function() {
		gulp.start('minVendorJs');
	});

	watch('public/src/js/**/*.js', function() {
		gulp.start('minAppJs');
	});

	watch('public/images/**/*.*', function() {
		gulp.start('minImages');
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

gulp.task('minAppCss', ['copyNoBowerMainCssDeps'], function() {
	return gulp.src('public/src/css/**/*.css')
		.pipe(sourcemaps.init())
		.pipe(cssnano())
		.pipe(concat('app.css'))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public/dist/css'));
});

gulp.task('copyNoBowerMainCssDeps', function() {
	return gulp.src('bower_components/html5-boilerplate/dist/css/*.css')
		.pipe(gulp.dest('public/src/css/vendor'));
});

gulp.task('minJs', ['minVendorJs', 'minAppJs']);

gulp.task('minVendorJs', function() {
	var jsFilter = filter('**/*.js');

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
		//.pipe(uglify())
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
