/* jshint esversion: 6 */
const del = require('del');
const cssSlam = require('css-slam').gulp;

const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require('gulp-util');
const htmlMinifier = require('gulp-html-minifier');
const imagemin = require('gulp-imagemin');
const uglify = require('gulp-uglify');
const $ = require('gulp-load-plugins')();

const mergeStream = require('merge-stream');
const polymerBuild = require('polymer-build');
const forkStream = polymerBuild.forkStream;
const HtmlSplitter = polymerBuild.HtmlSplitter;

const runSequence = require('run-sequence');
const historyApiFallback = require('connect-history-api-fallback');
const browserSync = require('browser-sync');
const reload = browserSync.reload;
const babel = require('rollup-plugin-babel');


const packageJson = require('./package.json');
const polymerJson = require('./polymer.json');
const swPrecacheConfig = require('./sw-precache-config.js');
const buildDirectory = 'build';

const dist = function(subpath) {
  return !subpath ? buildDirectory : path.join(buildDirectory, subpath);
};


function clean() {
  console.log(`Deleting ${buildDirectory} directory...`);
  return del([buildDirectory]);
}
gulp.task('clean', clean);


/**
 * Waits for the given ReadableStream
 */
function waitFor(stream) {
  return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

function rollupApp() {
  return $.rollup({
    allowRealFiles: true, // !IMPORTANT, it avoids the hypothetical file system error
    entry: 'src/scripts/app.js',
    // sourceMap: true,
    plugins: [babel({
      presets: ['es2015-rollup'],
    })],
    format: 'umd',
    moduleName: 'app'
  });
}

function jsRollup() {
  return gulp.src(['src/**/*.js'])
   // .pipe($.sourcemaps.init())
   .pipe(rollupApp())
   // .pipe($.sourcemaps.write('.'))
   .pipe(gulp.dest(`${buildDirectory}/src/scripts`))
   .pipe(gulp.dest(dist()));
}
gulp.task('js-rollup', jsRollup);


function buildPolymer() {
  const project = new polymerBuild.PolymerProject(polymerJson);
  return Promise.resolve().then(() => {
    const sourcesHtmlSplitter = new HtmlSplitter();
    // Okay, now let's get your source files
    let sourcesStream = project.sources()
      .pipe(gulpif(/scripts\/app\.js$/, rollupApp()));

    // Okay, now let's do the same to your dependencies
    let dependenciesStream = project.dependencies();

    // Okay, now let's merge them into a single build stream
    let buildStream = mergeStream(sourcesStream, dependenciesStream)
      .once('data', () => {
        console.log('Analyzing build dependencies...');
      });

    // Okay, time to pipe to the build directory
    buildStream = buildStream.pipe(gulp.dest(buildDirectory));

    // waitFor the buildStream to complete
    return waitFor(buildStream);
  })
  .then(() => {
    // You did it!
    console.log('Build complete!');
  });
}
gulp.task('build-polymer', buildPolymer);

function buildPolymerDist() {
  const project = new polymerBuild.PolymerProject(polymerJson);
  return Promise.resolve().then(() => {
    const sourcesHtmlSplitter = new HtmlSplitter();
    // Okay, now let's get your source files
    let sourcesStream = project.sources()
      .pipe(sourcesHtmlSplitter.split())
      .pipe(gulpif(/scripts\/app\.js$/, rollupApp()))
      // .pipe(gulpif(/\.js$/, $.babel({
      //   presets: ['es2015']
      // })))
      // .pipe(gulpif(/\.js$/, uglify()))
      // .pipe(gulpif(/\.css$/, cssSlam()))
      // .pipe(gulpif(/\.html$/, htmlMinifier()))
      // .pipe(gulpif(/\.(png|gif|jpg|svg)$/, imagemin()))
      .pipe(sourcesHtmlSplitter.rejoin());

    const dependenciesHtmlSplitter = new HtmlSplitter();
    // Okay, now let's do the same to your dependencies
    let dependenciesStream = project.dependencies()
      .pipe(dependenciesHtmlSplitter.split())
      // .pipe(gulpif(/\.js$/, uglify({ preserveComments: 'license' })))
      // .pipe(gulpif(/\.css$/, cssSlam()))
      // .pipe(gulpif(/\.html$/, htmlMinifier()))
      .pipe(dependenciesHtmlSplitter.rejoin());

    // Okay, now let's merge them into a single build stream
    let buildStream = mergeStream(sourcesStream, dependenciesStream)
      .once('data', () => {
        console.log('Analyzing build dependencies...');
      });

    // If you want bundling, pass the stream to project.bundler.
    // This will bundle dependencies into your fragments so you can lazy
    // load them.
    buildStream = buildStream.pipe(project.bundler());

    // Okay, time to pipe to the build directory
    buildStream = buildStream.pipe(gulp.dest(buildDirectory));

    // waitFor the buildStream to complete
    return waitFor(buildStream);
  })
  .then(() => {
    // Okay, now let's generate the Service Worker
    console.log('Generating the Service Worker...');
    return polymerBuild.addServiceWorker({
      project: project,
      buildRoot: buildDirectory,
      bundled: true,
      swPrecacheConfig: swPrecacheConfig
    });
  })
  .then(() => {
    // You did it!
    console.log('Dist Build complete!');
  });
}
gulp.task('build-polymer-dist', buildPolymerDist);


gulp.task('build', ['clean'], function(cb) {
  // Uncomment 'cache-config' if you are going to use service workers.
  runSequence(
    'build-polymer',
    cb);
});

gulp.task('build:dist', ['clean'], function(cb) {
  // Uncomment 'cache-config' if you are going to use service workers.
  runSequence(
    'build-polymer-dist',
    cb);
});


// Watch files for changes & reload
gulp.task('serve', ['build'], function() {
  browserSync({
    port: 5000,
    notify: false,
    logPrefix: 'PSK',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function(snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: {
      // baseDir: ['src', 'images', 'node_modules', 'bower_components'],
      baseDir: [dist()],
      // server: dist(),
      /*routes: {
        '/node_modules': 'node_modules'
      },*/
      middleware: [historyApiFallback()]
    }
  });

  gulp.watch(['src/**/*.js'], ['js-rollup', reload]);
  gulp.watch(['src/**/*.html'], ['build-polymer', reload]);
  // gulp.watch(['styles/**/*.css'], ['build-polymer', reload]);
  gulp.watch(['images/**/*'], ['build-polymer', reload]);
});

// Build and serve the output from the dist build
gulp.task('serve:dist', ['build:dist'], function() {
  browserSync({
    port: 5001,
    notify: false,
    logPrefix: 'PSK',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function(snippet) {
          return snippet;
        }
      }
    },
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: dist(),
    middleware: [historyApiFallback()]
  });

  gulp.watch(['src/**/*'], ['build-polymer-dist', reload]);
  // gulp.watch(['styles/**/*.css'], ['build-polymer-dist', reload]);
  gulp.watch(['images/**/*'], ['build-polymer-dist', reload]);
});




const realFavicon = require ('gulp-real-favicon');

// File where the favicon markups are stored
const FAVICON_DATA_FILE = 'faviconData.json';

// Generate the icons. This task takes a few seconds to complete.
// You should run it at least once to create the icons. Then,
// you should run it whenever RealFaviconGenerator updates its
// package (see the check-for-favicon-update task below).
gulp.task('generate-favicon', function(done) {
  realFavicon.generateFavicon({
    masterPicture: 'images/app-logo-source.png',
    dest: buildDirectory + '/images/touch',
    iconsPath: '/',
    design: {
      ios: {
        pictureAspect: 'backgroundAndMargin',
        backgroundColor: '#ffffff',
        margin: '0%',
        assets: {
          ios6AndPriorIcons: false,
          ios7AndLaterIcons: false,
          precomposedIcons: false,
          declareOnlyDefaultIcon: true
        },
        appName: 'My App'
      },
      desktopBrowser: {},
      windows: {
        pictureAspect: 'noChange',
        backgroundColor: '#2b5797',
        onConflict: 'override',
        assets: {
          windows80Ie10Tile: false,
          windows10Ie11EdgeTiles: {
            small: false,
            medium: true,
            big: false,
            rectangle: false
          }
        },
        appName: 'My App'
      },
      androidChrome: {
        pictureAspect: 'shadow',
        themeColor: '#2e3aa1',
        manifest: {
          name: 'My App',
          display: 'standalone',
          orientation: 'notSet',
          onConflict: 'override',
          declared: true
        },
        assets: {
          legacyIcon: false,
          lowResolutionIcons: false
        }
      }/*,
      safariPinnedTab: {
        pictureAspect: 'blackAndWhite',
        threshold: 93.125,
        themeColor: '#5bbad5'
      }*/
    },
    settings: {
      scalingAlgorithm: 'Mitchell',
      errorOnImageTooSmall: false
    },
    markupFile: FAVICON_DATA_FILE
  }, function() {
    done();
  });
});

