/**
 * Platform Inject Plugin
 *
 * Transforms @platform comment blocks, springboard.runOn(...) calls, and strips
 * server-only state/action implementations from client builds.
 */

import * as parser from '@babel/parser';
import traverseImport, {NodePath} from '@babel/traverse';
import generateImport from '@babel/generator';
import type * as t from '@babel/types';

const traverse = ((traverseImport as any).default ?? traverseImport) as typeof traverseImport;
const generate = ((generateImport as any).default ?? (generateImport as any).generate ?? generateImport) as typeof generateImport;

export type SpringboardTransformPlatform =
    | 'node'
    | 'cf-workers'
    | 'web'
    | 'browser'
    | 'browser_offline'
    | 'tauri'
    | 'react-native-webview'
    | 'react-native'
    | 'fetch';

const ALL_PLATFORM_MACRO_TARGETS = [
    'browser',
    'node',
    'fetch',
    'cf-workers',
    'web',
    'tauri',
    'react-native',
    'react-native-webview',
    'server',
    'client',
    'user-agent',
] as const;

type ApplyPlatformTransformOptions = {
    preserveServerStatesAndActions?: boolean;
};

type NormalizedSpringboardTransformPlatform = Exclude<SpringboardTransformPlatform, 'browser' | 'fetch'>;

function normalizePlatform(platform: SpringboardTransformPlatform): NormalizedSpringboardTransformPlatform {
    if (platform === 'fetch') return 'cf-workers';
    if (platform === 'browser') return 'web';
    return platform;
}

function platformMatches(buildPlatformRaw: SpringboardTransformPlatform, targetPlatform: string): boolean {
    const buildPlatform = normalizePlatform(buildPlatformRaw);

    switch (buildPlatform) {
        case 'node':
            return targetPlatform === 'node' || targetPlatform === 'server';
        case 'cf-workers':
            return targetPlatform === 'cf-workers' || targetPlatform === 'fetch' || targetPlatform === 'server';
        case 'web':
        case 'browser_offline':
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
        default: {
            const _exhaustive: never = buildPlatform;
            return false;
        }
    }
}

function isClientPlatform(platformRaw: SpringboardTransformPlatform): boolean {
    const platform = normalizePlatform(platformRaw);
    switch (platform) {
        case 'node':
        case 'cf-workers':
            return false;
        case 'web':
        case 'browser_offline':
        case 'tauri':
        case 'react-native-webview':
        case 'react-native':
            return true;
        default: {
            const _exhaustive: never = platform;
            return true;
        }
    }
}

function transformPlatformBlocks(source: string, buildPlatform: SpringboardTransformPlatform): string {
    const platforms = ALL_PLATFORM_MACRO_TARGETS.join('|');
    const anyPlatformBlockRegex = new RegExp(`\\/\\/ @platform "(${platforms})"([\\s\\S]*?)\\/\\/ @platform end`, 'g');

    return source.replace(anyPlatformBlockRegex, (match, targetPlatform, content) => {
        if (platformMatches(buildPlatform, targetPlatform)) {
            return content;
        }

        // Preserve line count for reasonable sourcemaps/error locations.
        return '\n'.repeat(match.split('\n').length - 1);
    });
}

function parseSource(source: string) {
    return parser.parse(source, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
    });
}

function transformRunOnCalls(source: string, buildPlatform: SpringboardTransformPlatform): string {
    if (!/springboard\.runOn\(/.test(source)) {
        return source;
    }

    try {
        const ast = parseSource(source);

        traverse(ast, {
            CallExpression(path) {
                if (
                    path.node.callee.type === 'MemberExpression' &&
                    path.node.callee.object.type === 'Identifier' &&
                    path.node.callee.object.name === 'springboard' &&
                    path.node.callee.property.type === 'Identifier' &&
                    path.node.callee.property.name === 'runOn'
                ) {
                    const platformArg = path.node.arguments[0];
                    const callbackArg = path.node.arguments[1];

                    if (platformArg?.type !== 'StringLiteral' || !callbackArg) {
                        return;
                    }

                    if (platformMatches(buildPlatform, platformArg.value)) {
                        path.replaceWith({
                            type: 'CallExpression',
                            callee: callbackArg as any,
                            arguments: [],
                        } as any);
                    } else {
                        path.replaceWith({
                            type: 'Identifier',
                            name: 'undefined',
                        } as any);
                    }
                }
            },
        });

        return generate(ast, {}, source).code;
    } catch (err) {
        console.warn('[springboard] Failed to transform springboard.runOn calls:', err);
        return source;
    }
}

function getAsyncRouteComponentActiveKey(buildPlatformRaw: SpringboardTransformPlatform): 'browser' | 'reactNative' | null {
    const buildPlatform = normalizePlatform(buildPlatformRaw);

    if (buildPlatform === 'web' || buildPlatform === 'browser_offline' || buildPlatform === 'tauri' || buildPlatform === 'react-native-webview') {
        return 'browser';
    }

    if (buildPlatform === 'react-native') {
        return 'reactNative';
    }

    return null;
}

const getObjectPropertyName = (property: t.ObjectProperty): string | undefined => {
    const key = property.key;
    return key.type === 'Identifier'
        ? key.name
        : key.type === 'StringLiteral'
            ? key.value
            : undefined;
};

const prunePlatformRouteLoaderProperties = (
    objectExpression: t.ObjectExpression,
    activeKey: 'browser' | 'reactNative',
) => {
    objectExpression.properties = objectExpression.properties.filter((property) => {
        if (property.type !== 'ObjectProperty') {
            return true;
        }

        const propertyName = getObjectPropertyName(property);

        return propertyName !== 'browser' && propertyName !== 'reactNative' || propertyName === activeKey;
    });
};

export function transformAsyncRouteComponentBranches(source: string, buildPlatform: SpringboardTransformPlatform): string {
    if (!/(asyncRouteComponent\s*\(|defineRoute\s*\()/.test(source)) {
        return source;
    }

    const activeKey = getAsyncRouteComponentActiveKey(buildPlatform);
    if (!activeKey) {
        return source;
    }

    try {
        const ast = parseSource(source);

        traverse(ast, {
            CallExpression(path) {
                if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'asyncRouteComponent') {
                    const firstArg = path.node.arguments[0];
                    if (firstArg?.type === 'ObjectExpression') {
                        prunePlatformRouteLoaderProperties(firstArg, activeKey);
                    }
                }

                if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'defineRoute') {
                    const firstArg = path.node.arguments[0];
                    if (firstArg?.type !== 'ObjectExpression') {
                        return;
                    }

                    for (const property of firstArg.properties) {
                        if (property.type !== 'ObjectProperty') {
                            continue;
                        }

                        if (getObjectPropertyName(property) === 'component' && property.value.type === 'ObjectExpression') {
                            prunePlatformRouteLoaderProperties(property.value, activeKey);
                        }
                    }
                }
            },
        });

        return generate(ast, {}, source).code;
    } catch (err) {
        console.warn('[springboard] Failed to transform asyncRouteComponent platform branches:', err);
        return source;
    }
}

function getMemberExpressionPropertyName(member: t.MemberExpression): string | undefined {
    return member.property.type === 'Identifier' ? member.property.name : undefined;
}

function isModuleApiServerCall(callExpr: t.CallExpression, methodName: string): boolean {
    if (methodName === 'createServerState' || methodName === 'createServerStates' || methodName === 'createServerAction' || methodName === 'createServerActions') {
        return true;
    }

    if (methodName !== 'createServerStates' && methodName !== 'createServerActions') {
        return false;
    }

    if (callExpr.callee.type !== 'MemberExpression') {
        return false;
    }

    return callExpr.callee.object.type === 'MemberExpression' &&
        getMemberExpressionPropertyName(callExpr.callee.object) === 'server';
}

function stripServerStatesAndActions(source: string): string {
    const hasServerCalls = /createServer(State|States|Action|Actions)/.test(source) ||
        /\.server\.createServer(States|Actions)/.test(source);

    if (!hasServerCalls) {
        return source;
    }

    try {
        const ast = parseSource(source);
        const nodesToRemove: NodePath<t.VariableDeclaration>[] = [];

        traverse(ast, {
            VariableDeclaration(path) {
                for (const declaration of path.node.declarations) {
                    if (!declaration.init) continue;

                    let callExpr: t.Expression | t.PrivateName = declaration.init;
                    if (callExpr.type === 'AwaitExpression') {
                        callExpr = callExpr.argument;
                    }

                    if (callExpr.type !== 'CallExpression') continue;
                    if (callExpr.callee.type !== 'MemberExpression') continue;

                    const methodName = getMemberExpressionPropertyName(callExpr.callee);
                    if (!methodName || !isModuleApiServerCall(callExpr, methodName)) continue;

                    if (methodName === 'createServerState' || methodName === 'createServerStates') {
                        nodesToRemove.push(path);
                    }

                    if (methodName === 'createServerAction') {
                        const lastArgIndex = callExpr.arguments.length - 1;
                        if (lastArgIndex >= 0) {
                            callExpr.arguments[lastArgIndex] = {
                                type: 'ArrowFunctionExpression',
                                params: [],
                                body: {type: 'BlockStatement', body: [], directives: []},
                                async: true,
                            } as any;
                        }
                    }

                    if (methodName === 'createServerActions') {
                        const firstArg = callExpr.arguments[0];
                        if (firstArg?.type === 'ObjectExpression') {
                            for (const prop of firstArg.properties) {
                                if (prop.type === 'ObjectProperty' &&
                                    (prop.value.type === 'ArrowFunctionExpression' || prop.value.type === 'FunctionExpression')) {
                                    prop.value.body = {type: 'BlockStatement', body: [], directives: []};
                                }
                            }
                        }
                    }
                }
            },
        });

        for (const nodePath of [...new Set(nodesToRemove)].reverse()) {
            nodePath.remove();
        }

        return generate(ast, {}, source).code;
    } catch (err) {
        console.warn('[springboard] Failed to strip server states/actions:', err);
        return source;
    }
}

/**
 * Apply platform transform to code if it contains platform markers, runOn calls,
 * or server-only API calls.
 */
export function applyPlatformTransform(
    code: string,
    id: string,
    targetPlatform: SpringboardTransformPlatform,
    options: ApplyPlatformTransformOptions = {}
): { code: string; map: null } | null {
    // Only process TypeScript/JavaScript files.
    if (!/\.[tj]sx?$/.test(id)) {
        return null;
    }

    // Skip node_modules.
    if (id.includes('node_modules')) {
        return null;
    }

    let transformedCode = code;

    if (code.includes('// @platform')) {
        transformedCode = transformPlatformBlocks(transformedCode, targetPlatform);
    }

    transformedCode = transformRunOnCalls(transformedCode, targetPlatform);
    transformedCode = transformAsyncRouteComponentBranches(transformedCode, targetPlatform);

    if (isClientPlatform(targetPlatform) && !options.preserveServerStatesAndActions) {
        transformedCode = stripServerStatesAndActions(transformedCode);
    }

    if (transformedCode === code) {
        return null;
    }

    return {
        code: transformedCode,
        map: null,
    };
}
