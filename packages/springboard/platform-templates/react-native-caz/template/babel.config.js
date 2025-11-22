const fs = require('node:fs');

const plugins = [
  ['./babel_plugins/babel_plugin_platform_comments.js', { platform: 'react-native' }],
];

// TODO: this is a WIP to support developing alongside open-source repo. haven't gotten the imports to work yet
// The compilation error that I receive: "Unable to resolve "../jamtools/packages/springboard/core/engine/engine" from "apps/mobile/App.tsx""
if (process.env.USE_DEV_ALIASES) {
  const cwd = process.cwd();
  const devPathFileName = `${cwd}/../../scripts/dev_cycle/dev_paths.json`;
  let devAliases = {};
  try {
    devAliases = JSON.parse(fs.readFileSync(devPathFileName).toString());
  } catch (e) {
    console.error(`USE_DEV_ALIASES env var is true, and failed to parse ${devPathFileName}`, e);
    process.exit(1);
  }

  // for (const key of Object.keys(devAliases)) {
  //     devAliases[key] = devAliases[key];
  // }

  plugins.push(['module-resolver', {
    root: ['../..'],
    alias: devAliases,
  }]);
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
