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

    // Create CLAUDE.md and AGENTS.md for AI coding agents
    const agentDocsContent = `# Springboard Development Guide

This application is built with the **Springboard framework**.

## Getting Started

**Before writing any code, run:**

\`\`\`bash
npx sb docs context
\`\`\`

This outputs comprehensive framework information including available documentation
sections, key concepts, and workflow guidance.

## Recommended Workflow

1. **Run \`sb docs context\`** at the start of your session
2. **Write code** using your knowledge + the context from step 1
3. **Fetch specific docs** only when needed: \`sb docs get <section>\`
4. **View examples** for reference code: \`sb docs examples show <name>\`

## Other Useful Commands

- \`sb docs --help\` - See all available commands
- \`sb docs types\` - Get TypeScript type definitions
- \`sb docs examples list\` - See available example modules
`;
    writeFileSync(`${process.cwd()}/CLAUDE.md`, agentDocsContent);
    writeFileSync(`${process.cwd()}/AGENTS.md`, agentDocsContent);
    console.log('Created CLAUDE.md and AGENTS.md with AI agent instructions');

    const packageJsonPath = `${process.cwd()}/package.json`;
    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
    packageJson.scripts = {
        ...packageJson.scripts,
        'dev': 'sb dev src/index.tsx',
        'build': 'sb build src/index.tsx',
        'start': 'sb start',
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('Project created successfully! Run the following to start the development server:\n');
    console.log('npm run dev\n');
});

if (!(globalThis as any).AVOID_PROGRAM_PARSE) {
    program.parse();
}
