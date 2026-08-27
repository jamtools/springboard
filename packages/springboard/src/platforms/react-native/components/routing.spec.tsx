import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {asyncRouteComponent, collectRouteDescriptors, defineRoute, defineRoutes, useNavigate, useParams, useSearch} from '../../../router/index';

vi.mock('react-native', () => ({
    Button: (props: {title: string; onPress: () => void}) => React.createElement('button', {onClick: props.onPress}, props.title),
    Text: (props: React.PropsWithChildren<{testID?: string; role?: string}>) => React.createElement(
        'span',
        {'data-testid': props.testID, role: props.role},
        props.children,
    ),
    View: (props: React.PropsWithChildren<{testID?: string; accessibilityLabel?: string}>) => React.createElement(
        'div',
        {'data-testid': props.testID, 'data-source': props.accessibilityLabel},
        props.children,
    ),
}));

const RootScreen = () => {
    const navigate = useNavigate();

    return (
        <div>
            <div>Root screen</div>
            <button
                onClick={() => navigate({
                    to: '/songs/$songId',
                    params: {songId: 'abc'},
                    search: {tab: 'lyrics'},
                })}
            >
                Open song
            </button>
        </div>
    );
};

const SongScreen = () => {
    const params = useParams({from: '/songs/$songId'});
    const search = useSearch({from: '/songs/$songId'}) as {tab: 'overview' | 'lyrics'};

    return (
        <div>
            <div>Song screen</div>
            <div data-testid="song-id">{params.songId}</div>
            <div data-testid="song-tab">{search.tab}</div>
        </div>
    );
};

const testRoutes = defineRoutes([
    defineRoute({path: '/', component: RootScreen}),
    defineRoute({
        path: '/songs/$songId',
        component: SongScreen,
        validateSearch: (search) => ({
            tab: search.tab === 'lyrics' ? 'lyrics' as const : 'overview' as const,
        }),
    }),
]);

const BrowserFallbackScreen = () => <div>Browser fallback screen</div>;
const NativeAsyncScreen = () => <div>Native async screen</div>;

const webViewFallbackRoutes = defineRoutes([
    defineRoute({
        path: '/web-only/$itemId',
        component: asyncRouteComponent({
            browser: async () => BrowserFallbackScreen,
        }),
        validateSearch: (search) => ({
            mode: search.mode === 'local' ? 'local' as const : 'remote' as const,
        }),
    }),
]);

const brokenNativeRoutes = defineRoutes([
    defineRoute({
        path: '/broken-native',
        component: asyncRouteComponent({
            browser: async () => BrowserFallbackScreen,
            reactNative: async () => undefined,
        }),
    }),
]);

const nativeAsyncRoutes = defineRoutes([
    defineRoute({
        path: '/native-async',
        component: asyncRouteComponent({
            browser: async () => BrowserFallbackScreen,
            reactNative: async () => NativeAsyncScreen,
        }),
    }),
]);

const routingMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    route: {
        name: 'springboard_route_root',
        params: {
            __springboardRouteId: 'springboard_route_root',
            __springboardPathParams: {},
            __springboardSearch: {},
        } as Record<string, unknown>,
    },
    navigationContainerProps: [] as Array<{linking?: unknown}>,
    modules: [] as Array<{moduleId: string; routes: readonly unknown[]}>,
}));

vi.mock('@react-navigation/native', () => ({
    NavigationContainer: (props: React.PropsWithChildren<{linking?: unknown}>) => {
        routingMocks.navigationContainerProps.push({linking: props.linking});
        return (
            <div data-testid="navigation-container">{props.children}</div>
        );
    },
    useNavigation: () => ({
        navigate: routingMocks.navigate,
    }),
    useRoute: () => routingMocks.route,
}));

const screenComponents: React.ComponentType[] = [];

vi.mock('@react-navigation/native-stack', () => ({
    createNativeStackNavigator: () => ({
        Navigator: ({children}: React.PropsWithChildren) => (
            <div data-testid="native-stack">{children}</div>
        ),
        Screen: (props: {
            name: string;
            component: React.ComponentType;
            initialParams: object;
        }) => {
            screenComponents.push(props.component);
            return (
                <div data-testid={`screen-${props.name}`} data-initial-params={JSON.stringify(props.initialParams)}>
                    {React.createElement(props.component)}
                </div>
            );
        },
    }),
}));

vi.mock('../../../core/engine/engine', () => ({
    useSpringboardEngine: () => ({
        moduleRegistry: {
            useModules: () => routingMocks.modules,
        },
    }),
}));

describe('Springboard React Navigation routing host', () => {
    beforeEach(() => {
        screenComponents.length = 0;
        routingMocks.navigate.mockClear();
        routingMocks.navigationContainerProps.length = 0;
        routingMocks.modules = [
            {
                moduleId: 'TestModule',
                routes: testRoutes,
            },
        ];
        routingMocks.route = {
            name: 'springboard_route_root',
            params: {
                __springboardRouteId: 'springboard_route_root',
                __springboardPathParams: {},
                __springboardSearch: {},
            },
        };
    });

    it('renders an owned NavigationContainer with configurable linking prefixes and an embeddable generated stack', async () => {
        const {SpringboardReactNavigationHost} = await import('./routing');

        render(<SpringboardReactNavigationHost linkingPrefixes={['springboard://']} />);

        expect(screen.getByTestId('navigation-container')).toBeTruthy();
        expect(routingMocks.navigationContainerProps[0].linking).toEqual({
            prefixes: ['springboard://'],
            config: {
                screens: {
                    springboard_route_root: '',
                    springboard_route_songs_songId: 'songs/:songId',
                },
            },
        });
        expect(screen.getByTestId('native-stack')).toBeTruthy();
        expect(screen.getByTestId('screen-springboard_route_root')).toBeTruthy();
        expect(screen.getByTestId('screen-springboard_route_songs_songId')).toBeTruthy();
        expect(screen.getAllByText('Root screen').length).toBeGreaterThan(0);
        expect(new Set(screenComponents).size).toBe(1);
    });

    it('converts Springboard dynamic paths to React Navigation linking paths', async () => {
        const {createSpringboardLinkingConfig, springboardPathToReactNavigationPath} = await import('./routing');
        const routes = collectRouteDescriptors([{moduleId: 'TestModule', routes: testRoutes}]);

        expect(springboardPathToReactNavigationPath('/songs/$songId')).toBe('songs/:songId');
        expect(createSpringboardLinkingConfig(routes, ['springboard://']).prefixes).toEqual(['springboard://']);
        expect(createSpringboardLinkingConfig(routes).config.screens).toEqual({
            springboard_route_root: '',
            springboard_route_songs_songId: 'songs/:songId',
        });
    });

    it('navigates to dynamic routes with serializable Springboard route params', async () => {
        const {SpringboardReactNavigationHost} = await import('./routing');

        render(<SpringboardReactNavigationHost />);

        fireEvent.click(screen.getAllByText('Open song')[0]);

        expect(routingMocks.navigate).toHaveBeenCalledWith('springboard_route_songs_songId', {
            __springboardRouteId: 'springboard_route_songs_songId',
            __springboardPathParams: {songId: 'abc'},
            __springboardSearch: {tab: 'lyrics'},
        });
    });

    it('decodes dynamic deep-link-style params and normalizes search once in the screen context', async () => {
        routingMocks.route = {
            name: 'springboard_route_songs_songId',
            params: {
                songId: 'deep-link-song',
                tab: 'lyrics',
            },
        };
        const {SpringboardReactNavigationHost} = await import('./routing');

        render(<SpringboardReactNavigationHost />);

        expect(screen.getAllByTestId('song-id')[0].textContent).toBe('deep-link-song');
        expect(screen.getAllByTestId('song-tab')[0].textContent).toBe('lyrics');
    });

    it('loads async reactNative route components with React Query', async () => {
        routingMocks.modules = [{moduleId: 'AsyncModule', routes: nativeAsyncRoutes}];
        routingMocks.route = {
            name: 'springboard_route_native_async',
            params: {},
        };
        const {SpringboardReactNavigationHost} = await import('./routing');

        render(<SpringboardReactNavigationHost />);

        expect(await screen.findAllByText('Native async screen')).toHaveLength(1);
    });

    it('falls back to async-resolved remote and local WebView targets only for missing reactNative branches', async () => {
        routingMocks.modules = [{moduleId: 'WebModule', routes: webViewFallbackRoutes}];
        routingMocks.route = {
            name: 'springboard_route_web_only_itemId',
            params: {
                itemId: '123',
                mode: 'remote',
            },
        };
        const resolveWebViewTarget = vi.fn(async (context) => (
            context.search.mode === 'local'
                ? {kind: 'local' as const, uri: 'file:///local-web/index.html'}
                : {kind: 'remote' as const, url: 'https://example.test/web-only/123?mode=remote'}
        ));
        const {SpringboardReactNavigationHost} = await import('./routing');

        const {rerender} = render(<SpringboardReactNavigationHost resolveWebViewTarget={resolveWebViewTarget} />);

        const remoteWebView = await screen.findByTestId('springboard-webview-fallback');
        expect(resolveWebViewTarget).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'missing-native-component',
            routeId: 'springboard_route_web_only_itemId',
            path: '/web-only/$itemId',
            pathParams: {itemId: '123'},
            search: {mode: 'remote'},
            platform: 'reactNative',
        }));
        expect(remoteWebView.getAttribute('data-source')).toBe('https://example.test/web-only/123?mode=remote');
        expect(remoteWebView.textContent).toContain('remote');

        routingMocks.route = {
            name: 'springboard_route_web_only_itemId',
            params: {
                itemId: '123',
                mode: 'local',
            },
        };

        rerender(<SpringboardReactNavigationHost resolveWebViewTarget={resolveWebViewTarget} />);

        const localWebView = await screen.findByTestId('springboard-webview-fallback');
        expect(localWebView.getAttribute('data-source')).toBe('file:///local-web/index.html');
        expect(localWebView.textContent).toContain('local');
    });

    it('allows apps to render resolved WebView targets with their own host component', async () => {
        routingMocks.modules = [{moduleId: 'WebModule', routes: webViewFallbackRoutes}];
        routingMocks.route = {
            name: 'springboard_route_web_only_itemId',
            params: {
                itemId: 'custom-host',
                mode: 'remote',
            },
        };
        const {SpringboardReactNavigationHost} = await import('./routing');

        render(
            <SpringboardReactNavigationHost
                resolveWebViewTarget={async () => ({kind: 'remote', url: 'https://example.test/custom-host'})}
                renderWebViewTarget={(target) => (
                    <div data-testid="app-webview-host">{target.kind === 'remote' ? target.url : target.uri}</div>
                )}
            />,
        );

        expect((await screen.findByTestId('app-webview-host')).textContent).toBe('https://example.test/custom-host');
    });


    it('does not fallback when a selected reactNative loader resolves undefined', async () => {
        routingMocks.modules = [{moduleId: 'BrokenModule', routes: brokenNativeRoutes}];
        routingMocks.route = {
            name: 'springboard_route_broken_native',
            params: {},
        };
        const {SpringboardReactNavigationHost} = await import('./routing');

        render(
            <SpringboardReactNavigationHost
                resolveWebViewTarget={async () => ({kind: 'remote', url: 'https://example.test'})}
            />,
        );

        expect(await screen.findByText(/resolved to undefined/i)).toBeTruthy();
        expect(screen.queryByTestId('springboard-webview-fallback')).toBeNull();
    });
});
