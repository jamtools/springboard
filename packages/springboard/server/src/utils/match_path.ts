/**
 * Route matching utilities copied from react-router
 * Source: react-router@7.9.5/dist/development/index-react-server.js
 *
 * These functions are copied here to avoid importing React Router dependencies
 * in server code, allowing us to use route matching without pulling in the
 * full React Router library.
 */

function warning(cond: boolean, message: string) {
    if (!cond) {
        if (typeof console !== 'undefined') console.warn(message);
        try {
            throw new Error(message);
        } catch (e) {
            // Intentionally empty
        }
    }
}

type PathPattern = {
    path: string;
    caseSensitive?: boolean;
    end?: boolean;
} | string;

type PathMatch = {
    params: Record<string, string | undefined>;
    pathname: string;
    pathnameBase: string;
    pattern: PathPattern;
};

type PathParam = {
    paramName: string;
    isOptional?: boolean;
};

export function matchPath(pattern: PathPattern, pathname: string): PathMatch | null {
    if (typeof pattern === 'string') {
        pattern = { path: pattern, caseSensitive: false, end: true };
    }

    const [matcher, compiledParams] = compilePath(
        pattern.path,
        pattern.caseSensitive,
        pattern.end
    );

    const match = pathname.match(matcher);
    if (!match) return null;

    let matchedPathname = match[0];
    let pathnameBase = matchedPathname.replace(/(.)\/+$/, '$1');
    const captureGroups = match.slice(1);

    const params = compiledParams.reduce(
        (memo, { paramName, isOptional }, index) => {
            if (paramName === '*') {
                const splatValue = captureGroups[index] || '';
                pathnameBase = matchedPathname.slice(0, matchedPathname.length - splatValue.length).replace(/(.)\/+$/, '$1');
            }
            const value = captureGroups[index];
            if (isOptional && !value) {
                memo[paramName] = undefined;
            } else {
                memo[paramName] = (value || '').replace(/%2F/g, '/');
            }
            return memo;
        },
        {} as Record<string, string | undefined>
    );

    return {
        params,
        pathname: matchedPathname,
        pathnameBase,
        pattern
    };
}

function compilePath(path: string, caseSensitive = false, end = true): [RegExp, PathParam[]] {
    warning(
        path === '*' || !path.endsWith('*') || path.endsWith('/*'),
        `Route path "${path}" will be treated as if it were "${path.replace(/\*$/, '/*')}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${path.replace(/\*$/, '/*')}".`
    );

    const params: PathParam[] = [];
    let regexpSource = '^' + path
        .replace(/\/*\*?$/, '')
        .replace(/^\/*/, '/')
        .replace(/[\\.*+^${}|()[\]]/g, '\\$&')
        .replace(
            /\/:([\w-]+)(\?)?/g,
            (_, paramName, isOptional) => {
                params.push({ paramName, isOptional: isOptional != null });
                return isOptional ? '/?([^\\/]+)?' : '/([^\\/]+)';
            }
        )
        .replace(/\/([\w-]+)\?(\/|$)/g, '(/$1)?$2');

    if (path.endsWith('*')) {
        params.push({ paramName: '*' });
        regexpSource += path === '*' || path === '/*' ? '(.*)$' : '(?:\\/(.+)|\\/*)$';
    } else if (end) {
        regexpSource += '\\/*$';
    } else if (path !== '' && path !== '/') {
        regexpSource += '(?:(?=\\/|$))';
    }

    const matcher = new RegExp(regexpSource, caseSensitive ? undefined : 'i');
    return [matcher, params];
}
