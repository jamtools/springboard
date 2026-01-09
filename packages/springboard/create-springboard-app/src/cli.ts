import {program} from 'commander';

import {execSync} from 'child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {join} from 'path';

import packageJSON from '../package.json';
import {workflows} from './generated-workflows';
import {actions} from './generated-actions';

function writeDirectoryRecursive(dir: string, data: any, basePath: string = '') {
    for (const [key, value] of Object.entries(data)) {
        const fullPath = join(dir, basePath, key);
        
        if (typeof value === 'string') {
            // It's a file - create directory structure and write file
            mkdirSync(join(dir, basePath), { recursive: true });
            writeFileSync(fullPath, value);
        } else if (typeof value === 'object' && value !== null) {
            // It's a directory - recurse
            writeDirectoryRecursive(dir, value, join(basePath, key));
        }
    }
}

function setupGithubWorkflows(targetDir: string) {
    const targetGithubDir = join(targetDir, '.github');
    
    try {
        // Create .github directory structure
        mkdirSync(targetGithubDir, { recursive: true });
        
        // Write workflows
        const workflowsDir = join(targetGithubDir, 'workflows');
        mkdirSync(workflowsDir, { recursive: true });
        
        for (const [filename, content] of Object.entries(workflows)) {
            writeFileSync(join(workflowsDir, filename), content);
        }
        
        // Write actions
        const actionsDir = join(targetGithubDir, 'actions');
        writeDirectoryRecursive(actionsDir, actions);
        
        console.log('GitHub workflows and actions setup successfully!');
        
    } catch (error) {
        console.warn('Warning: Could not setup GitHub workflows:', error instanceof Error ? error.message : String(error));
    }
}

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
        console.log('Using pnpm as the package manager\n');
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

    // Set up GitHub workflows and actions
    setupGithubWorkflows(process.cwd());

    console.log('Project created successfully! Run the following to start the development server:\n');
    console.log('npm run dev\n');
});

if (!(globalThis as any).AVOID_PROGRAM_PARSE) {
    program.parse();
}
