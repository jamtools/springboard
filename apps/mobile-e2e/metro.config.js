const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const appRoot = __dirname;
const workspaceRoot = path.resolve(appRoot, '../..');
const config = getDefaultConfig(appRoot);

const appModules = path.resolve(appRoot, 'node_modules');
const aliases = new Map([
  ['react', path.join(appModules, 'react')],
  ['react-native', path.join(appModules, 'react-native')],
  ['@react-native/assets-registry', path.join(appModules, '@react-native/assets-registry')],
]);
const defaultResolveRequest = config.resolver.resolveRequest;
const resolveWithDefault = (context, moduleName, platform) => (
  defaultResolveRequest || context.resolveRequest
)(context, moduleName, platform);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  appModules,
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [alias, targetRoot] of aliases) {
    if (moduleName === alias || moduleName.startsWith(`${alias}/`)) {
      const target = moduleName === alias
        ? targetRoot
        : path.join(targetRoot, moduleName.slice(alias.length + 1));
      return resolveWithDefault(context, target, platform);
    }
  }

  return resolveWithDefault(context, moduleName, platform);
};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: aliases.get('react'),
  'react-native': aliases.get('react-native'),
  '@react-native/assets-registry': aliases.get('@react-native/assets-registry'),
};
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'asset']));

module.exports = config;
