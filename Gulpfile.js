'use strict';

var gulp = require('gulp'),
	addsrc = require('gulp-add-src'),
	angularFileSort = require('gulp-angular-filesort'),
	concat = require('gulp-concat'),
	cssnano = require('gulp-cssnano'),
	del = require('del'),
	filter = require('gulp-filter'),
	flatten = require('gulp-flatten'),
	htmlmin = require('gulp-htmlmin'),
	imagemin = require('gulp-imagemin'),
	inject = require('gulp-inject'),
	install = require('gulp-install'),
	jshint = require('gulp-jshint'),
	mainBowerFiles = require('gulp-main-bower-files'),
	path = require('path'),
	pngquant = require('imagemin-pngquant'),
	run = require('childish-process'),
	sourcemaps = require('gulp-sourcemaps'),
	uglify = require('gulp-uglify'),
	watch = require('gulp-watch');


var paths = joinPaths();
var filters = joinFilters();

function joinPaths() {
	var paths = { };

	paths.files = { };

	paths.files.startScript = './bin/www';
	paths.files.bower = './bower.json';
	paths.files.npm = './package.json';
	paths.files.gulpfile = './Gulpfile.js';
	paths.files.jshintrc = './.jshintrc';
	paths.files.jshintrcnode = '.jshintrc-node';

	paths.files.vendorCss = 'vendor.css';
	paths.files.appCss = 'app.css';

	paths.files.vendorJs = 'vendor.js';
	paths.files.appJs = 'app.js';

	paths.bower = './bower_components/';
	paths.npm = './node_modules/';
	paths.public = './public/';

	paths.files.mainCss = path.join(paths.bower, 'html5-boilerplate/dist/css/main.css');
	paths.files.normalizeCss = path.join(paths.bower, 'html5-boilerplate/dist/css/normalize.css');

	paths.src = path.join(paths.public, 'src/');
	paths.dist = path.join(paths.public, 'dist/');

	paths.html = { };
	paths.css = { };
	paths.js = { };
	paths.img = { };

	paths.css.dist = path.join(paths.dist, 'css/');
	paths.css.vendor = path.join(paths.css.dist, 'vendor/');

	paths.js.dist = path.join(paths.dist, 'js/');
	paths.js.app = path.join(paths.js.dist, 'courierchat/');
	paths.js.vendor = path.join(paths.js.dist, 'vendor/');

	paths.img.src = path.join(paths.src + 'images/');
	paths.img.dist = path.join(paths.dist + 'images/');

	return paths;
}

function joinFilters() {
	var filters = { };

	filters.html = { };
	filters.css = { };
	filters.js = { };
	filters.img = { };

	filters.generic = '**/*';
	filters.html.generic = '**/*.html';
	filters.css.generic = '**/*.css';
	filters.js.generic = '**/*.js';
	filters.img.generic = '**/*.*';

	filters.bower = path.join(paths.bower, filters.generic);
	filters.npm = path.join(paths.npm, filters.generic);
	filters.dist = path.join(paths.dist, filters.generic);

	filters.src = path.join(paths.src, filters.generic);

	filters.html.bower = path.join(paths.bower, filters.html.generic);
	filters.html.src = path.join(paths.src, filters.html.generic);
	filters.html.dist = path.join(paths.dist, filters.html.generic);

	filters.css.bower = path.join(paths.bower, filters.css.generic);
	filters.css.src = path.join(paths.src, filters.css.generic);
	filters.css.dist = path.join(paths.dist, filters.css.generic);
	filters.css.vendor = path.join(paths.css.vendor, filters.css.generic);

	filters.js.bower = path.join(paths.bower, filters.js.generic);
	filters.js.src = path.join(paths.src, filters.js.generic);
	filters.js.dist = path.join(paths.dist, filters.js.generic);
	filters.js.app = path.join(paths.js.app, filters.js.generic);
	filters.js.vendor = path.join(paths.js.vendor, filters.js.generic);

	filters.img.src = path.join(paths.img.src, filters.img.generic);
	filters.img.dist = path.join(paths.img.dist, filters.img.generic);

	return filters;
}

gulp.task('default', ['serve']);

gulp.task('serve', function() {
	run('node ' + paths.files.startScript);
	gulp.start('watch');
});

gulp.task('serve:prod', function() {
	gulp.start('build:prod');
	run('node ' + paths.files.startScript);
});

gulp.task('watch', ['build', 'registerWatchTasks']);

gulp.task('build', ['clean', 'jshint', 'jshint:node', 'copyHtml', 'copyImages']);

gulp.task('build:prod', ['clean', 'install', 'jshint', 'jshint:node', 'minHtml', 'minImages']);

gulp.task('install', function() {
	gulp.src([paths.files.bower, paths.files.npm])
		.pipe(install());
});

gulp.task('clean', function(cb) {
	del.sync(paths.dist, cb);
});

gulp.task('registerWatchTasks', function() {
	watch(paths.files.gulpfile, function() {
		gulp.start('build');
	});

	watch([
		filters.css.bower,
		filters.src
	], function() {
		gulp.start('copyHtml');
	});

	watch(paths.files.jshintrc, function() {
		gulp.start('jshint');
	});


	watch(filters.img.src, function() {
		gulp.start('copyImages');
	});
});

gulp.task('copyHtml', ['copyVendorCss', 'copyAppCss', 'copyVendorJs', 'copyAppJs'], function() {
	var html = gulp.src(filters.html.src);

	html =
		html.pipe(inject(gulp.src(filters.css.vendor, { read: false }), {
			starttag: '<!-- inject:vendor:{{ext}} -->',
			ignorePath: paths.dist
		}))
		.pipe(inject(gulp.src([filters.css.dist, '!' + filters.css.vendor], { read: false }), {
			starttag: '<!-- inject:app:{{ext}} -->',
			ignorePath: paths.dist
		}))
		.pipe(inject(gulp.src(filters.js.vendor).pipe(angularFileSort()), {
			starttag: '<!-- inject:vendor:{{ext}} -->',
			ignorePath: paths.dist
		}))
		.pipe(inject(gulp.src(filters.js.app).pipe(angularFileSort()), {
			starttag: '<!-- inject:app:{{ext}} -->',
			ignorePath: paths.dist
		}));

	return html.pipe(gulp.dest(paths.dist));
});

gulp.task('minHtml', ['minVendorCss', 'minAppCss', 'minVendorJs', 'minAppJs'] , function() {
	var html = gulp.src(filters.html.src);

	html =
		html.pipe(inject(gulp.src(path.join(paths.css.dist, paths.files.vendorCss), { read: false }), {
				starttag: '<!-- inject:vendor:{{ext}} -->',
				ignorePath: paths.dist
			}))
			.pipe(inject(gulp.src(path.join(paths.css.dist, paths.files.appCss), { read: false }), {
				starttag: '<!-- inject:app:{{ext}} -->',
				ignorePath: paths.dist
			}))
			.pipe(inject(gulp.src(path.join(paths.js.dist, paths.files.vendorJs), { read: false }), {
				starttag: '<!-- inject:vendor:{{ext}} -->',
				ignorePath: paths.dist
			}))
			.pipe(inject(gulp.src(path.join(paths.js.dist, paths.files.appJs), { read: false }), {
				starttag: '<!-- inject:app:{{ext}} -->',
				ignorePath: paths.dist
			}));

	return html
		.pipe(htmlmin({ collapseWhitespace: true }))
		.pipe(gulp.dest(paths.dist));
});

gulp.task('copyVendorCss', function() {
	return gulp.src(paths.files.bower)
		.pipe(mainBowerFiles())
		.pipe(filter(filters.css.generic))
		.pipe(addsrc.prepend(paths.files.mainCss))
		.pipe(addsrc.prepend(paths.files.normalizeCss))
		.pipe(flatten())
		.pipe(gulp.dest(paths.css.vendor));
});

gulp.task('copyAppCss', function() {
	return gulp.src(filters.css.src)
		.pipe(gulp.dest(paths.css.dist));
});

gulp.task('minCss', ['minVendorCss', 'minAppCss']);

gulp.task('minVendorCss', function() {
	return gulp.src(paths.files.bower)
		.pipe(mainBowerFiles())
		.pipe(filter(filters.css.generic))
		.pipe(addsrc.prepend(paths.files.mainCss))
		.pipe(addsrc.prepend(paths.files.normalizeCss))
		.pipe(sourcemaps.init())
		.pipe(concat(paths.files.vendorCss))
		.pipe(cssnano())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(paths.css.dist));
});

gulp.task('minAppCss', function() {
	return gulp.src(filters.css.src)
		.pipe(sourcemaps.init())
		.pipe(cssnano())
		.pipe(concat(paths.files.appCss))
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(paths.css.dist));
});

gulp.task('jshint', function() {
	return gulp.src(filters.js.src)
		.pipe(jshint(paths.files.jshintrc))
		.pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('copyVendorJs', function() {
	return gulp.src('./bower.json')
		.pipe(mainBowerFiles())
		.pipe(filter(filters.js.generic))
		.pipe(flatten())
		.pipe(gulp.dest(paths.js.vendor));
});

gulp.task('copyAppJs', function() {
	return gulp.src(filters.js.src)
		.pipe(angularFileSort())
		.pipe(gulp.dest(paths.dist));
});

gulp.task('minJs', ['minVendorJs', 'minAppJs']);

gulp.task('minVendorJs', function() {
	return gulp.src(paths.files.bower)
		.pipe(mainBowerFiles())
		.pipe(filter(filters.js.generic))
		.pipe(sourcemaps.init())
		.pipe(concat(paths.files.vendorJs))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(paths.js.dist));
});

gulp.task('minAppJs', ['jshint'], function() {
	return gulp.src(filters.js.src)
		.pipe(angularFileSort())
		.pipe(sourcemaps.init())
		.pipe(concat(paths.files.appJs))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest(paths.js.dist));
});

gulp.task('copyImages', function() {
	return gulp.src(filters.img.src)
		.pipe(gulp.dest(paths.img.dist));
});

gulp.task('minImages', function() {
	return gulp.src(filters.img.src)
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
		.pipe(gulp.dest(paths.img.dist));
});

gulp.task('jshint:node', function() {
	return gulp.src([
		filters.js.generic,
		'!' + filters.bower,
		'!' + filters.npm,
		'!' + filters.dist
	])
	.pipe(jshint(paths.files.jshintrcnode))
	.pipe(jshint.reporter('jshint-stylish'));
});
