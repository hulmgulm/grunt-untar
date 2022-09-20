'use strict';

const tar = require('tar'),
  zlib = require('zlib'),
  fs = require('fs-extra'),
  path = require('path'),
  async = require('async');

function contains(array, value) {
  return array.indexOf(value) > -1;
}

/**
 * Return true if the processed file must be unzipped.
 * Check the mode and default to analyzing the file extension.
 *
 * @param file the processed file
 * @param [mode] the mode
 * @returns {Boolean} true if the file must be unzipped
 */
function mustUnzip(file, mode) {
  if (mode) {
    return mode === 'tgz';
  }
  const extension = path.extname(file);
  return contains(['.tgz', '.gz'], extension);
}

/**
 * Check that the passed mode is valid and will be correctly interpreted by the task.
 *
 * @param mode
 * @returns {boolean}
 */
function isValidMode(mode) {
  return mode === null || contains(['tgz', 'tar'], mode);
}

/**
 * Registers a grunt task named 'untar' that will extract the tar files passed to it.
 *
 * @param grunt
 */
module.exports = function(grunt) {
  grunt.registerMultiTask('untar', 'Extract tar files', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    const options = this.options({
      mode: null
    });

    if (!isValidMode(options.mode)) {
      grunt.fail.fatal(`Invalid mode ${options.mode}`);
    }

    const done = this.async();

    async.eachSeries(this.files, (f, next) => {
      const src = f.src.filter(filepath => {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn(`Source file "${filepath}" not found.`);
          return false;
        }
        return true;
      });

      async.eachSeries(src, (file, cb) => {
        grunt.log.writeln(`Untarring ${file} to ${f.dest}`);

        fs.ensureDir(f.dest, err => {
          if (err) {
            grunt.log.error(`Error creating target directory: ${err}`);
            return cb();
          }

          let stream = fs.createReadStream(file);
          if (mustUnzip(file, options.mode)) {
            // stream through a zip extractor
            stream = stream.pipe(zlib.createGunzip());
            stream.on('error', err => {
              grunt.log.error(`Error creating pipe: ${err}`);
              cb();
            });
          }

          // stream to file through a TAR extractor
          stream.pipe(tar.extract({ cwd: f.dest }))
            .on('error', err => {
              grunt.log.error(`Error untarring file: ${err}`);
              cb();
            })
            .on('end', cb);
        });
      }, next);
    }, done);
  });
};
