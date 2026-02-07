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

    // Create CLAUDE.md for Claude Code agents
    const claudeMdContent = `# Springboard Development Guide

This application is built with the **Springboard framework**.

Before writing any code, run:

\`\`\`bash
npx sb docs --help
\`\`\`

This will show you available documentation commands that help ensure your code is correct and uses the framework as intended.

## Key Commands

- \`sb docs list\` - List available documentation sections
- \`sb docs get <section>\` - Fetch specific documentation
- \`sb docs validate <file>\` - Validate your module code
- \`sb docs scaffold <type> <name>\` - Generate module templates
- \`sb docs context\` - Get full framework context

## Workflow

1. Run \`sb docs context\` at the start of your session
2. Use \`sb docs list\` to find relevant documentation
3. Always run \`sb docs validate <file>\` before finishing work
4. Use \`sb docs scaffold\` to generate new modules

This ensures your code follows Springboard patterns and avoids common mistakes.
`;
    writeFileSync(`${process.cwd()}/CLAUDE.md`, claudeMdContent);
    console.log('Created CLAUDE.md with AI agent instructions');

    // Create AGENTS.md for other AI coding assistants
    const agentsMdContent = `# AI Agent Instructions

This application is created with the **Springboard framework**.

## Before You Start

Run this command to learn about available documentation tools:

\`\`\`bash
npx sb docs --help
\`\`\`

## Important

Please lean on the \`sb docs\` commands to make sure the code you're writing is correct and uses the framework as intended.

### Available Commands

- \`sb docs list\` - Discover what documentation is available
- \`sb docs get <section>\` - Fetch documentation for a specific topic
- \`sb docs validate <file>\` - Check if your code follows Springboard patterns
- \`sb docs scaffold <type> <name>\` - Generate boilerplate for new modules
- \`sb docs context\` - Get comprehensive framework information

### Recommended Workflow

1. Start by running \`sb docs context\` to understand the framework
2. Use \`sb docs list\` to find relevant documentation for your task
3. Validate your code with \`sb docs validate <file>\` before completing
4. Generate new modules with \`sb docs scaffold\` for consistent structure

These tools help prevent common mistakes and ensure your code aligns with Springboard's architecture.
`;
    writeFileSync(`${process.cwd()}/AGENTS.md`, agentsMdContent);
    console.log('Created AGENTS.md with AI agent instructions');

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
