const del = require('del');
const cssSlam = require('css-slam').gulp;

const gulp = require('gulp');
const gulpif = require('gulp-if');
const gutil = require('gulp-util');
const htmlMinifier = require('gulp-html-minifier');
const imagemin = require('gulp-imagemin');
const uglify = require('gulp-uglify');
// const $ = require('gulp-load-plugins')();

const mergeStream = require('merge-stream');
const polymerBuild = require('polymer-build');
const forkStream = polymerBuild.forkStream;
const HtmlSplitter = polymerBuild.HtmlSplitter;


const swPrecacheConfig = require('./sw-precache-config.js');
const polymerJson = require('./polymer.json');
const project = new polymerBuild.PolymerProject(polymerJson);
const buildDirectory = 'build';


gulp.task('clean', function() {
  return del(['build']);
});


/**
 * Waits for the given ReadableStream
 */
function waitFor(stream) {
  return new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

function build() {
  return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
    // Okay, so first thing we do is clear the build directory
    console.log(`Deleting ${buildDirectory} directory...`);
    del([buildDirectory])
      .then(() => {
        const sourcesHtmlSplitter = new HtmlSplitter();
        // Okay, now let's get your source files
        let sourcesStream = project.sources()
          // Oh, well do you want to minify stuff? Go for it!
          // Here's how splitHtml & gulpif work
          .pipe(sourcesHtmlSplitter.split())
          // .pipe(gulpif(/\.js$/, uglify()))
          // .pipe(gulpif(/\.css$/, cssSlam()))
          // .pipe(gulpif(/\.html$/, htmlMinifier()))
          .pipe(gulpif(/\.(png|gif|jpg|svg)$/, imagemin()))
          .pipe(sourcesHtmlSplitter.rejoin());

        const dependenciesHtmlSplitter = new HtmlSplitter();
        // Okay, now let's do the same to your dependencies
        let dependenciesStream = project.dependencies()
          .pipe(dependenciesHtmlSplitter.split())
          // .pipe(gulpif(/\.js$/, uglify()))
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
      // .then(() => {
      //   return polymerBuild.generateServiceWorker({
      //     buildRoot: 'build/',
      //     project: project,
      //     bundled: true, // set if `project.bundler()` was used
      //     swPrecacheConfig: {
      //       // See https://github.com/GoogleChrome/sw-precache#options-parameter for all supported options
      //       navigateFallback: '/index.html',
      //     }
      //   });
      // })
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
        console.log('Build complete!');
        resolve();
      });
  });
}

gulp.task('build', build);

