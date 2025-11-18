var configDir = process.env.npm_package_config_dir;

module.exports = {
    extends: [
       configDir + '/.eslintrc.js'
    ],
};
