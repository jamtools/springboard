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
import viteString from './example/vite-as-string';

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
        console.log('Using pnpm as the package manager\n');
        packageManager = 'pnpm';
    } catch (error) {
    }

    const npmRcContent = [
        // 'node-linker=hoisted',
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
        '.springboard',
    ];

    writeFileSync('./.gitignore', gitIgnore.join('\n'), {flag: 'a'});

    const jamToolsPackage = template === 'jamtools' ? `@jamtools/core@${version}` : '';

    // Use consolidated springboard package with subpath imports
    const installDepsCommand = [
        packageManager,
        'install',
        `springboard@${version}`,
        jamToolsPackage,
        'react',
        'react-dom',
        'react-router',
        '@hono/node-server',
        'better-sqlite3',
        'crossws',
        'hono',
        'immer',
        'kysely',
        'rxjs',
    ];
    console.log(installDepsCommand.join(' '));
    execSync(installDepsCommand.join(' '), {cwd: process.cwd(), stdio: 'inherit'});

    const installDevDepsCommand = `${packageManager} install -D vite typescript @types/node @types/react @types/react-dom`;
    console.log(installDevDepsCommand);
    execSync(installDevDepsCommand, {cwd: process.cwd(), stdio: 'inherit'});

    execSync(`npm rebuild better-sqlite3`, {cwd: process.cwd()});

    execSync(`mkdir -p src`, {cwd: process.cwd()});
    writeFileSync(`${process.cwd()}/src/index.tsx`, exampleString);
    console.log('Created application entrypoint src/index.tsx');

    writeFileSync(`${process.cwd()}/vite.config.ts`, viteString);
    console.log('Created vite config vite.config.ts');

    const packageJsonPath = `${process.cwd()}/package.json`;
    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());

    packageJson.type = 'module';

    packageJson.scripts = {
        ...packageJson.scripts,
        // 'dev': 'sb dev src/index.tsx',
        // 'build': 'sb build src/index.tsx',
        // 'start': 'sb start',
        dev: 'vite',
        build: 'npm run build:web && npm run build:node',
        'build:web': 'SPRINGBOARD_PLATFORM=web vite build',
        'build:node': 'SPRINGBOARD_PLATFORM=node vite build --outDir dist/node',
        'check-types': 'tsc --noEmit',
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('Project created successfully! Run the following to start the development server:\n');
    console.log('npm run dev\n');
});

if (!(globalThis as any).AVOID_PROGRAM_PARSE) {
    program.parse();
}
