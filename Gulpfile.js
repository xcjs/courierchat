'use strict';

var gulp = require('gulp'),
	addsrc = require('gulp-add-src'),
	angularFileSort = require('gulp-angular-filesort'),
	concat = require('gulp-concat'),
	cssnano = require('gulp-cssnano'),
	del = require('del'),
	filter = require('gulp-filter'),
	htmlmin = require('gulp-htmlmin'),
	imagemin = require('gulp-imagemin'),
	inject = require('gulp-inject'),
	install = require('gulp-install'),
	jshint = require('gulp-jshint'),
	mainBowerFiles = require('gulp-main-bower-files'),
	pngquant = require('imagemin-pngquant'),
	run = require('childish-process'),
	sourcemaps = require('gulp-sourcemaps'),
	uglify = require('gulp-uglify'),
	watch = require('gulp-watch');

gulp.task('default', ['serve']);

gulp.task('serve', function() {
	run('node ./bin/www');
	run('gulp watch');
});

gulp.task('watch', ['build', 'registerWatchTasks']);

gulp.task('build', ['clean', 'install', 'jshint', 'jshint:node', 'copyVendorCss', 'copyAppCss', 'copyVendorJs', 'copyAppJs', 'copyHtml', 'copyImages']);

gulp.task('build:prod', ['clean', 'install', 'jshint', 'jshint:node', 'minCss', 'minJs', 'minHtml', 'minImages']);

gulp.task('install', function() {
	gulp.src(['./bower.json', './package.json'])
		.pipe(install());
});

gulp.task('clean', function(cb) {
	del.sync(['public/dist'], cb);
});

gulp.task('registerWatchTasks:prod', function() {
	watch('Gulpfile.js', function() {
		gulp.start('build');
	});

	watch('public/src/js/**/*.html', function() {
		gulp.start('copyHtml');
	});

	watch('bower_components/**/*.css', function() {
		gulp.start('copyVendorCss');
	});

	watch('public/src/css/**/*.css', function() {
		gulp.start('copyAppJs');
	});

	watch('.jshintrc', function() {
		gulp.start('jshint');
	});

	watch('bower_components/**/*.js', function() {
		gulp.start('copyVendorJs');
	});

	watch('public/src/js/**/*.js', function() {
		gulp.start('copyAppJs');
	});

	watch('public/images/**/*.*', function() {
		gulp.start('copyImages');
	});
});

gulp.task('copyHtml', ['copyVendorCss', 'copyAppCss', 'copyVendorJs', 'copyAppJs'], function() {
	return gulp.src('public/src/**/*.html')
		.pipe(inject(gulp.src('public/dist/css/vendor/**/*.css', { read: false }), { starttag: '<!-- inject:vendor:{{ext}} -->' }))
		.pipe(inject(gulp.src(['public/dist/css/**/*.css', '!public/dist/css/vendor/**/*.css'], { read: false }), { starttag: '<!-- inject:app:{{ext}} -->' }))
		.pipe(inject(gulp.src('public/dist/js/vendor/**/*.js').pipe(angularFileSort()), { starttag: '<!-- inject:vendor:{{ext}} -->' }))
		.pipe(inject(gulp.src('public/dist/js/courierchat/**/*.js').pipe(angularFileSort()), { starttag: '<!-- inject:app:{{ext}} -->' }))
		.pipe(gulp.dest('public/dist'));
});

gulp.task('minHtml', function() {
	return gulp.src('public/src/**/*.html')
		.pipe(htmlmin({collapseWhitespace: true}))
		.pipe(gulp.dest('public/dist'));
});

gulp.task('copyVendorCss', function() {
	var cssFilter = filter('**/*.css');

	return gulp.src('./bower.json')
		.pipe(mainBowerFiles())
		.pipe(cssFilter)
		.pipe(addsrc.prepend('bower_components/html5-boilerplate/dist/css/main.css'))
		.pipe(addsrc.prepend('bower_components/html5-boilerplate/dist/css/normalize.css'))
		.pipe(gulp.dest('public/dist/css/vendor'));
});

gulp.task('copyAppCss', function() {
	return gulp.src('public/src/css/**/*.css')
		.pipe(gulp.dest('public/dist/css'));
});

gulp.task('minCss', ['minVendorCss', 'minAppCss']);

gulp.task('minVendorCss', function() {
	var cssFilter = filter('**/*.css');

	return gulp.src('./bower.json')
		.pipe(mainBowerFiles())
		.pipe(cssFilter)
		.pipe(addsrc.prepend('bower_components/html5-boilerplate/dist/css/main.css'))
		.pipe(addsrc.prepend('bower_components/html5-boilerplate/dist/css/normalize.css'))
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

gulp.task('jshint', function() {
	return gulp.src('public/src/js/**/*.js')
		.pipe(jshint('.jshintrc'))
		.pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('copyVendorJs', function() {
	var jsFilter = filter('**/*.js');

	return gulp.src('./bower.json')
		.pipe(mainBowerFiles())
		.pipe(jsFilter)
		.pipe(gulp.dest('public/dist/js/vendor'));
});

gulp.task('copyAppJs', function() {
	return gulp.src('public/src/js/**/*.js')
		.pipe(angularFileSort())
		.pipe(gulp.dest('public/dist/js'));
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

gulp.task('minAppJs', ['jshint'], function() {
	return gulp.src('public/src/js/**/*.js')
		.pipe(angularFileSort())
		.pipe(sourcemaps.init())
		.pipe(concat('app.js'))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('public/dist/js'));
});

gulp.task('copyImages', function() {
	return gulp.src('public/src/images/**/*')
		.pipe(gulp.dest('public/dist/images'));
});

gulp.task('minImages', function() {
	return gulp.src('public/src/images/**/*')
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

gulp.task('jshint:node', function() {
	return gulp.src([
		'**/*.js',
		'!bower_components/**/*.*',
		'!node_modules/**/*.*',
		'!public/**/*.*'
	])
		.pipe(jshint('.jshintrc-node'))
		.pipe(jshint.reporter('jshint-stylish'));
});
