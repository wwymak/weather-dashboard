module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks

  grunt.initConfig({
    //paths : {
    //    scss: 'public/scss',
    //    css : 'public/css'
    //},

    babel: {
      options: {
        sourceMap: true,
        presets: ['es2015']
      },
      dist: {
        files: [
          {
            expand: true,     // Enable dynamic expansion.
            //cwd: '**/',      // Src matches are relative to this path.
            src: ['**/*.es6.js'], // Actual pattern(s) to match.
            //dest: '/',   // Destination path prefix.
            ext: '.js',   // Dest filepaths will have this extension.
          },
        ]
      }
    },
    watch: {
      scripts: {
        files: ['**/*.es6.js'],
        tasks: ["babel"]
      },
    }
  });

  grunt.registerTask('default', ['babel', 'watch']);
}
