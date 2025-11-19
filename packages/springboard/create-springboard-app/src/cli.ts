import {program} from 'commander';

import {execSync} from 'child_process';
import {readFileSync, writeFileSync} from 'fs';

import packageJSON from '../package.json';

program
    .name('create-springboard-app')
    .description('Generate a new Springboard application')
    .version(packageJSON.version);

const version = packageJSON.version;

import exampleString from './example/index-as-string';

program
.option('--template <bare | jamtools>', 'Template to use for the app', 'bare')
.action((options: {template?: string}) => {
    const DEFAULT_APPLICATION_TEMPLATE = 'bare';

    if (options.template && options.template !== 'bare' && options.template !== 'jamtools') {
        console.error('Invalid template specified. Must be "bare" or "jamtools"');
        process.exit(1);
    }

    console.log(`Creating springboard app with template "${options.template}"\n`);

    const template = options.template || DEFAULT_APPLICATION_TEMPLATE;

    let packageManager = 'npm';
    try {
        execSync('pnpm --version', {cwd: process.cwd(), stdio: 'ignore'});
        packageManager = 'pnpm';
    } catch (error) {
    }

    const npmRcContent = [
        'node-linker=hoisted',
    ];

    if (process.env.NPM_CONFIG_REGISTRY) {
        npmRcContent.push(`registry=${process.env.NPM_CONFIG_REGISTRY}`);
    }

    execSync('npm init -y', {cwd: process.cwd()});
    writeFileSync('./.npmrc', npmRcContent.join('\n'), {flag: 'w'});

    const gitIgnore = [
        'node_modules',
        'dist',
        'data/kv_data.json',
        'data/kv_data.db',
    ];

    writeFileSync('./.gitignore', gitIgnore.join('\n'), {flag: 'a'});

    const jamToolsPackage = template === 'jamtools' ? `@jamtools/core@${version}` : '';

    const installDepsCommand = `${packageManager} install springboard@${version} springboard-server@${version} @springboardjs/platforms-node@${version} @springboardjs/platforms-browser@${version} ${jamToolsPackage} react react-dom react-router`;
    console.log(installDepsCommand);
    execSync(installDepsCommand, {cwd: process.cwd(), stdio: 'inherit'});

    const installDevDepsCommand = `${packageManager} install -D springboard-cli@${version} typescript @types/node @types/react @types/react-dom`;
    console.log(installDevDepsCommand);
    execSync(installDevDepsCommand, {cwd: process.cwd(), stdio: 'inherit'});

    execSync(`mkdir -p src`, {cwd: process.cwd()});
    writeFileSync(`${process.cwd()}/src/index.tsx`, exampleString);
    console.log('Created application entrypoint src/index.tsx');

    const packageJsonPath = `${process.cwd()}/package.json`;
    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
    packageJson.scripts = {
        ...packageJson.scripts,
        'dev': 'sb dev src/index.tsx',
        'build': 'sb build src/index.tsx',
        'start': 'sb start',
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    execSync('git init', {cwd: process.cwd()});
    execSync('git add .', {cwd: process.cwd()});
    execSync('git commit -m "Initial commit"', {cwd: process.cwd()});

    console.log('Project created successfully! Run the following to start the development server:\n');
    console.log('npm run dev\n');
});

if (!(globalThis as any).AVOID_PROGRAM_PARSE) {
    program.parse();
}
