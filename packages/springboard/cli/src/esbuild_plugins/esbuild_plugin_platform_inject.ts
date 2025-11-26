import fs from 'fs';

import * as parser from '@babel/parser';
import traverse, {NodePath} from '@babel/traverse';
import generate from '@babel/generator';
import type {Plugin} from 'esbuild';
import type * as t from '@babel/types';
import type {SpringboardPlatform} from 'springboard/engine/register';

/**
 * ESBuild plugin for platform-specific code injection and transformation.
 *
 * **Responsibilities:**
 * 1. **Platform directive blocks** - Remove `@platform "..."` blocks for non-matching platforms
 * 2. **springboard.runOn()** - Transform to IIFE (if platform matches) or `undefined` (if doesn't match)
 * 3. **Server state removal** - Remove `createServerStates()` variable declarations in client builds
 * 4. **Server action stripping** - Strip bodies from `createServerActions()` in client builds
 *
 * **Platform Matrix:**
 * These must match the TypeScript types in `packages/springboard/core/engine/register.ts` (line 236-244).
 *
 * | Build Target | Accepts runOn(...) with |
 * |--------------|------------------------|
 * | `node` | `'node'`, `'server'` |
 * | `cf-workers` | `'cf-workers'`, `'server'` |
 * | `web`  | `'web'`, `'browser'`, `'client'`, `'user-agent'` |
 * | `tauri` | `'tauri'`, `'browser'`, `'client'`, `'user-agent'` |
 * | `react-native-webview` | `'react-native-webview'`, `'browser'`, `'client'` |
 * | `react-native` | `'react-native'`, `'user-agent'` |
 *
 * @see packages/springboard/core/engine/register.ts - TypeScript type definitions
 * @see packages/springboard/cli/src/esbuild_plugins/esbuild_plugin_platform_inject.test.ts - Test suite
 */
export const esbuildPluginPlatformInject = (
    platform: SpringboardPlatform,
    options?: {preserveServerStatesAndActions?: boolean}
): Plugin => {
    const preserveServerStatesAndActions = options?.preserveServerStatesAndActions || false;

    // Helper: Determine if platform is a client platform (should strip server states/actions)
    const isClientPlatform = (): boolean => {
        switch (platform) {
            case 'node':
            case 'cf-workers':
                // Server platforms - keep server states/actions
                return false;
            case 'web':
            case 'tauri':
            case 'react-native-webview':
            case 'react-native':
                // Client platforms - strip server states/actions
                return true;
            default:
                // Exhaustive check
                const _exhaustive: never = platform;
                return true; // Default to client for safety
        }
    };

    return {
        name: 'platform-macro',
        setup(build) {
            build.onLoad({filter: /\.tsx?$/}, async (args) => {
                let source = await fs.promises.readFile(args.path, 'utf8');

                // Early return if file doesn't need any transformations
                const hasPlatformAnnotations = /@platform "(node|cf-workers|web|tauri|react-native|react-native-webview|server|browser|client|user-agent)"/.test(source);
                // Detect both old and new API patterns for server calls
                const hasServerCalls = /createServer(State|States|Action|Actions)/.test(source) ||
                                       /\.server\.createServer(States|Actions)/.test(source);
                const needsServerProcessing = hasServerCalls && (isClientPlatform() && !preserveServerStatesAndActions);
                const hasRunOnCalls = /springboard\.runOn\(/.test(source);

                if (!hasPlatformAnnotations && !needsServerProcessing && !hasRunOnCalls) {
                    return {
                        contents: source,
                        loader: args.path.split('.').pop() as 'js',
                        };
                }

                // Helper function to check if a platform directive matches the current build target
                const platformMatches = (targetPlatform: string): boolean => {
                    switch (platform) {
                        case 'node':
                            return targetPlatform === 'node' || targetPlatform === 'server';
                        case 'cf-workers':
                            return targetPlatform === 'cf-workers' || targetPlatform === 'server';
                        case 'web':
                            return targetPlatform === 'web' ||
                                   targetPlatform === 'browser' ||
                                   targetPlatform === 'client' ||
                                   targetPlatform === 'user-agent';
                        case 'tauri':
                            return targetPlatform === 'tauri' ||
                                   targetPlatform === 'browser' ||
                                   targetPlatform === 'client' ||
                                   targetPlatform === 'user-agent';
                        case 'react-native-webview':
                            return targetPlatform === 'react-native-webview' ||
                                   targetPlatform === 'browser' ||
                                   targetPlatform === 'client';
                        case 'react-native':
                            return targetPlatform === 'react-native' || targetPlatform === 'user-agent';
                        default:
                            return false;
                    }
                };

                // Process all platform directive blocks
                const allPlatformBlocksRegex = /\/\/ @platform "([^"]+)"([\s\S]*?)\/\/ @platform end/g;
                source = source.replace(allPlatformBlocksRegex, (match, targetPlatform, content) => {
                    if (platformMatches(targetPlatform)) {
                        // Keep the content but remove the directives, preserving line numbers
                        return content;
                    } else {
                        // Remove the content but preserve line numbers by replacing with newlines
                        const lineCount = match.split('\n').length;
                        return '\n'.repeat(lineCount - 1);
                    }
                });

                // Transform springboard.runOn() calls
                if (hasRunOnCalls) {
                    try {
                        const ast = parser.parse(source, {
                            sourceType: 'module',
                            plugins: ['typescript', 'jsx'],
                        });

                        traverse(ast, {
                            CallExpression(path) {
                                // Check if this is a springboard.runOn() call
                                if (
                                    path.node.callee.type === 'MemberExpression' &&
                                    path.node.callee.object.type === 'Identifier' &&
                                    path.node.callee.object.name === 'springboard' &&
                                    path.node.callee.property.type === 'Identifier' &&
                                    path.node.callee.property.name === 'runOn'
                                ) {
                                    // First argument should be the platform string
                                    const platformArg = path.node.arguments[0];
                                    const callbackArg = path.node.arguments[1];

                                    if (
                                        platformArg &&
                                        platformArg.type === 'StringLiteral' &&
                                        callbackArg
                                    ) {
                                        const targetPlatform = platformArg.value;

                                        // Platform matching based on build target
                                        // Matches the matrix in packages/springboard/core/engine/register.ts (line 236-244)
                                        const platformMatches = (() => {
                                            switch (platform) {
                                                case 'node':
                                                    // node build accepts: 'node' and context 'server'
                                                    return targetPlatform === 'node' || targetPlatform === 'server';
                                                case 'cf-workers':
                                                    // cf-workers build accepts: 'cf-workers' and context 'server'
                                                    return targetPlatform === 'cf-workers' || targetPlatform === 'server';
                                                case 'web':
                                                    // web build accepts: 'web', 'browser' and contexts 'client', 'user-agent'
                                                    return targetPlatform === 'web' ||
                                                           targetPlatform === 'browser' ||
                                                           targetPlatform === 'client' ||
                                                           targetPlatform === 'user-agent';
                                                case 'tauri':
                                                    // tauri build accepts: 'tauri', 'browser' and contexts 'client', 'user-agent'
                                                    return targetPlatform === 'tauri' ||
                                                           targetPlatform === 'browser' ||
                                                           targetPlatform === 'client' ||
                                                           targetPlatform === 'user-agent';
                                                case 'react-native-webview':
                                                    // react-native-webview build accepts: 'react-native-webview', 'browser' and context 'client'
                                                    return targetPlatform === 'react-native-webview' ||
                                                           targetPlatform === 'browser' ||
                                                           targetPlatform === 'client';
                                                case 'react-native':
                                                    // react-native build accepts: 'react-native' and context 'user-agent'
                                                    return targetPlatform === 'react-native' || targetPlatform === 'user-agent';
                                                default:
                                                    // Exhaustive check - this should never happen with proper types
                                                    const _exhaustive: never = platform;
                                                    return false;
                                            }
                                        })();

                                        if (platformMatches) {
                                            // Replace with IIFE: (callback)()
                                            // The await is handled naturally at the parent level if needed
                                            path.replaceWith({
                                                type: 'CallExpression',
                                                callee: callbackArg as any,
                                                arguments: [],
                                            } as any);
                                        } else {
                                            // Replace with undefined
                                            path.replaceWith({
                                                type: 'Identifier',
                                                name: 'undefined',
                                            } as any);
                                        }
                                    }
                                }
                            },
                        });

                        // Generate the modified source
                        const output = generate(ast, {}, source);
                        source = output.code;
                    } catch (err) {
                        // If AST parsing fails, log warning but continue with original source
                        console.warn(`Failed to parse ${args.path} for runOn transformation:`, err);
                    }
                }

                if (isClientPlatform() && !preserveServerStatesAndActions) {
                    // Detect both old and new API patterns for server calls
                    const hasServerCalls = /createServer(State|States|Action|Actions)/.test(source) ||
                                           /\.server\.createServer(States|Actions)/.test(source);
                    if (hasServerCalls) {
                        try {
                            const ast = parser.parse(source, {
                                sourceType: 'module',
                                plugins: ['typescript', 'jsx'],
                            });

                            const nodesToRemove: NodePath<t.VariableDeclaration>[] = [];

                            traverse(ast, {
                                VariableDeclaration(path) {
                                    const declaration = path.node.declarations[0];
                                    if (!declaration || !declaration.init) return;

                                    // Handle await expressions
                                    let callExpr = declaration.init;
                                    if (callExpr.type === 'AwaitExpression') {
                                        callExpr = callExpr.argument;
                                    }

                                    if (callExpr.type !== 'CallExpression') return;
                                    if (callExpr.callee.type !== 'MemberExpression') return;
                                    if (callExpr.callee.property.type !== 'Identifier') return;

                                    const methodName = callExpr.callee.property.name;

                                    // Check for both old API (direct) and new API (namespaced)
                                    // Old API: moduleAPI.createServerStates({...})
                                    // New API: moduleAPI.server.createServerStates({...})
                                    let isServerMethod = false;
                                    let isServerStateMethod = false;
                                    let isServerActionMethod = false;

                                    // Check if this is the old API pattern
                                    if (methodName === 'createServerState' || methodName === 'createServerStates') {
                                        isServerMethod = true;
                                        isServerStateMethod = true;
                                    } else if (methodName === 'createServerAction' || methodName === 'createServerActions') {
                                        isServerMethod = true;
                                        isServerActionMethod = true;
                                    }
                                    // Check if this is the new namespaced API pattern
                                    else if (methodName === 'createServerStates' || methodName === 'createServerActions') {
                                        // Check if the call is on moduleAPI.server.*
                                        if (callExpr.callee.object.type === 'MemberExpression' &&
                                            callExpr.callee.object.property.type === 'Identifier' &&
                                            callExpr.callee.object.property.name === 'server') {
                                            isServerMethod = true;
                                            if (methodName === 'createServerStates') {
                                                isServerStateMethod = true;
                                            } else if (methodName === 'createServerActions') {
                                                isServerActionMethod = true;
                                            }
                                        }
                                    }

                                    if (!isServerMethod) return;

                                    // Remove entire variable declarations for createServerState/createServerStates
                                    if (isServerStateMethod) {
                                        nodesToRemove.push(path);
                                    }

                                    // For createServerAction/createServerActions, strip function bodies
                                    if (isServerActionMethod) {
                                        // For createServerAction (singular), handle the pattern: createServerAction(key, config, handler)
                                        // The handler is the 3rd argument (index 2) or could be in the 2nd if config is omitted
                                        if (methodName === 'createServerAction') {
                                            // Find the last argument (the handler function)
                                            const lastArgIndex = callExpr.arguments.length - 1;
                                            if (lastArgIndex >= 0) {
                                                // Replace whatever expression with an empty arrow function
                                                callExpr.arguments[lastArgIndex] = {
                                                    type: 'ArrowFunctionExpression',
                                                    params: [],
                                                    body: {
                                                        type: 'BlockStatement',
                                                        body: [],
                                                        directives: [],
                                                    },
                                                    async: true,
                                                } as any;
                                            }
                                        }

                                        // For createServerActions (plural), first argument should be an object with action definitions
                                        if (methodName === 'createServerActions') {
                                            const firstArg = callExpr.arguments[0];
                                            if (firstArg && firstArg.type === 'ObjectExpression') {
                                                firstArg.properties.forEach((prop: any) => {
                                                    if (prop.type === 'ObjectProperty' && prop.value) {
                                                        // Replace function bodies with empty arrow functions
                                                        if (prop.value.type === 'ArrowFunctionExpression' || prop.value.type === 'FunctionExpression') {
                                                            prop.value.body = {
                                                                type: 'BlockStatement',
                                                                body: [],
                                                                directives: [],
                                                            };
                                                        }
                                                    }
                                                });
                                            }
                                        }
                                    }
                                },
                            });

                            // Remove nodes in reverse order to avoid index shifting
                            nodesToRemove.reverse().forEach(path => path.remove());

                            // Generate the modified source
                            const output = generate(ast, {}, source);
                            source = output.code;
                        } catch (err) {
                            // If AST parsing fails, log warning but continue with original source
                            console.warn(`Failed to parse ${args.path} for server state/action removal:`, err);
                        }
                    }
                }

                return {
                    contents: source,
                    loader: args.path.split('.').pop() as 'js',
                };
            });
        },
    };
}
