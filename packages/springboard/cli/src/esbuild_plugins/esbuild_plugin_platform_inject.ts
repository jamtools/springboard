import fs from 'fs';

import * as parser from '@babel/parser';
import traverse, {NodePath} from '@babel/traverse';
import generate from '@babel/generator';
import type {Plugin} from 'esbuild';
import type * as t from '@babel/types';

export const esbuildPluginPlatformInject = (
    platform: 'node' | 'browser' | 'fetch' | 'react-native',
    options?: {preserveServerStatesAndActions?: boolean}
): Plugin => {
    const preserveServerStatesAndActions = options?.preserveServerStatesAndActions || false;

    return {
        name: 'platform-macro',
        setup(build) {
            build.onLoad({filter: /\.tsx?$/}, async (args) => {
                let source = await fs.promises.readFile(args.path, 'utf8');

                // Early return if file doesn't need any transformations
                const hasPlatformAnnotations = /@platform "(node|browser|react-native|fetch)"/.test(source);
                // Detect both old and new API patterns for server calls
                const hasServerCalls = /createServer(State|States|Action|Actions)/.test(source) ||
                                       /\.server\.createServer(States|Actions)/.test(source);
                const needsServerProcessing = hasServerCalls && ((platform === 'browser' || platform === 'react-native') && !preserveServerStatesAndActions);
                const hasRunOnCalls = /springboard\.runOn\(/.test(source);

                if (!hasPlatformAnnotations && !needsServerProcessing && !hasRunOnCalls) {
                    return {
                        contents: source,
                        loader: args.path.split('.').pop() as 'js',
                    };
                }

                // Then, replace platform-specific blocks based on the platform
                const platformRegex = new RegExp(`\/\/ @platform "${platform}"([\\s\\S]*?)\/\/ @platform end`, 'g');
                const otherPlatformRegex = new RegExp(`\/\/ @platform "(node|browser|react-native|fetch)"([\\s\\S]*?)\/\/ @platform end`, 'g');

                // Include only the code relevant to the current platform
                source = source.replace(platformRegex, '$1');

                // Remove the code for the other platforms
                source = source.replace(otherPlatformRegex, '');

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

                                        // Check if the target platform matches the current build platform
                                        const platformMatches = targetPlatform === platform;

                                        if (platformMatches) {
                                            // Replace with IIFE: (callback)()
                                            // The await is handled naturally at the parent level if needed
                                            path.replaceWith({
                                                type: 'CallExpression',
                                                callee: callbackArg as any,
                                                arguments: [],
                                            } as any);
                                        } else {
                                            // Replace with null
                                            path.replaceWith({
                                                type: 'NullLiteral',
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

                if ((platform === 'browser' || platform === 'react-native') && !preserveServerStatesAndActions) {
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
