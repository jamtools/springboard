#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function templateWorkflowContent(content) {
    let result = content
        // Remove specific repo secrets references
        .replace(/repository: \$\{\{ secrets\.REPO \}\}/g, '')
        .replace(/token: \$\{\{ secrets\.REPO_TOKEN \}\}/g, '')
        // Update checkout action to use current repo
        .replace(/uses: actions\/checkout@v3\s+with:\s+repository: \$\{\{ secrets\.REPO \}\}\s+token: \$\{\{ secrets\.REPO_TOKEN \}\}/g, 'uses: actions/checkout@v4')
        // Simplify ref usage
        .replace(/ref: \$\{\{ env\.TARGET_BRANCH \}\}/g, '')
        // Remove complex branch env logic for simplicity
        .replace(/env:\s+TARGET_BRANCH:.*$/gm, '')
        // Update to more generic build commands
        .replace(/SPRINGBOARD_PLATFORM_VARIANT=all pnpm run build/g, 'npm run build')
        .replace(/npx sb build \$\{\{ inputs\.entrypoint \}\}/g, 'npm run build')
        // Update pnpm commands to npm for compatibility
        .replace(/pnpm i/g, 'npm ci')
        .replace(/pnpm run /g, 'npm run ')
        // Remove db-specific workflows that won't apply to all apps
        .replace(/db-migrations:[\s\S]*?(?=^\w|\n$)/gm, '')
        // Remove enterprise-specific content
        .replace(/.*Enterprise.*\n/g, '')
        .replace(/cd packages\/enterprise.*\n/g, '')
        // Simplify test commands
        .replace(/cd tests-e2e && npm i/g, 'npm run test:e2e || echo "No e2e tests configured"')
        .replace(/cd tests-e2e && npm run check-types/g, 'npm run check-types:e2e || echo "No e2e type checking configured"')
        .replace(/cd db && pnpm i/g, 'echo "No db setup needed"')
        .replace(/cd db && pnpm run ci/g, 'echo "No db migrations needed"')
        // Clean up any remaining empty lines
        .replace(/\n\n\n+/g, '\n\n');

    // Add scaffolding functionality for springboard apps if needed
    if (result.includes('Build app') || result.includes('build')) {
        const scaffoldingStep = `
    - name: Scaffold Springboard app
      if: \${{ inputs.scaffold_springboard_project }}
      run: |
        mkdir -p apps
        cd apps
        npx create-springboard-app myapp --template bare
`;
        
        // Insert scaffolding step before the build step
        result = result.replace(
            /(- name: Build[^:]*[\s\S]*?run:)/,
            scaffoldingStep + '\n$1'
        );
    }

    // Add workflow inputs for scaffolding if it's a workflow file
    if (result.includes('workflow_dispatch:') && !result.includes('scaffold_springboard_project:')) {
        result = result.replace(
            /(workflow_dispatch:\s*\n\s*inputs:)/,
            `$1
      scaffold_springboard_project:
        description: 'Whether to scaffold a new Springboard project'
        required: false
        default: false
        type: boolean`
        );
    }

    return result;
}

function readDirectoryRecursive(dir, basePath = '') {
    const files = {};
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(basePath, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
            files[relativePath] = readDirectoryRecursive(fullPath, relativePath);
        } else {
            const content = fs.readFileSync(fullPath, 'utf8');
            const templatedContent = templateWorkflowContent(content);
            files[relativePath] = templatedContent;
        }
    }
    
    return files;
}

function generateTypeScript(data, name) {
    const jsonString = JSON.stringify(data, null, 2)
        // Escape backticks in the JSON string
        .replace(/`/g, '\\`')
        // Escape ${} template literals
        .replace(/\$\{/g, '\\${');
    
    return `// Auto-generated file - do not edit manually
// Generated from ${name} YAML files

export const ${name} = ${jsonString};

export default ${name};
`;
}

// Main execution
const projectRoot = path.dirname(__dirname);
const workflowsDir = path.join(projectRoot, 'workflows');
const actionsDir = path.join(projectRoot, 'actions');
const srcDir = path.join(projectRoot, 'src');

// Read workflows
const workflows = {};
if (fs.existsSync(workflowsDir)) {
    const workflowFiles = fs.readdirSync(workflowsDir);
    for (const file of workflowFiles) {
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
            const templatedContent = templateWorkflowContent(content);
            workflows[file] = templatedContent;
        }
    }
}

// Read actions
let actions = {};
if (fs.existsSync(actionsDir)) {
    actions = readDirectoryRecursive(actionsDir);
}

// Generate TypeScript files
fs.writeFileSync(
    path.join(srcDir, 'generated-workflows.ts'),
    generateTypeScript(workflows, 'workflows')
);

fs.writeFileSync(
    path.join(srcDir, 'generated-actions.ts'),
    generateTypeScript(actions, 'actions')
);

console.log('Generated workflows and actions TypeScript files');