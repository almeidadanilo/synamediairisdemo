// craco.config.js
const path = require('path');

module.exports = {
  devServer: (devServerConfig) => {
    // Ignore changes under public/specials so CRA doesn't live-reload
    devServerConfig.watchFiles = {
      paths: ['public/**/*', 'src/**/*'],
      options: {
        ignored: ['**/public/specials/**', '**/build/specials/**'],
      },
    };

    // Also ensure static watcher ignores the same folder
    const statics = Array.isArray(devServerConfig.static)
      ? devServerConfig.static
      : [devServerConfig.static].filter(Boolean);

    statics.forEach((entry) => {
      if (entry && entry.watch) {
        entry.watch.ignored = [
          ...(Array.isArray(entry.watch.ignored) ? entry.watch.ignored : []),
          '**/public/specials/**',
          '**/build/specials/**',
        ];
      }
    });

    return devServerConfig;
  },
};
