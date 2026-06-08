import React, {useEffect, useRef, useState} from 'react';
import {BackHandler, StyleSheet, View} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {WebView} from 'react-native-webview';
import type {ShouldStartLoadRequest} from 'react-native-webview/lib/WebViewTypes';

import type {Springboard} from '../../../core/engine/engine.js';
import {
    BundledWebAssetModules,
    loadBundledWebAppAssets,
} from '../services/expo_bundled_web_asset_loader.js';

type NavigationState = {
    canGoBack: boolean;
    canGoForward: boolean;
    loading: boolean;
};

const initialNavigationState: NavigationState = {
    canGoBack: false,
    canGoForward: false,
    loading: false,
};

export type SpringboardExpoWebViewHostProps = {
    engine: Springboard | null;
    assetModules?: BundledWebAssetModules;
    siteUrl?: string;
    loadFromSiteUrl?: boolean;
    handleMessageFromWebview: (message: string) => void;
    onMessageFromRN: (cb: (message: string) => void) => void;
    spaRoute?: {route: string} | null;
    onShouldStartLoadWithRequest?: (request: ShouldStartLoadRequest) => boolean;
    hideSplashScreen?: () => Promise<void>;
    splashHideDelayMs?: number;
    transformHtml?: (html: string, paths: {htmlFilePath: string; cssFilePath: string; jsFilePath: string}) => string;
    onWebViewError?: (error: unknown) => void;
};

export const SpringboardExpoWebViewHost = (props: SpringboardExpoWebViewHostProps) => {
    const [nonce, setNonce] = useState(Math.random().toString());
    const [htmlUri, setHtmlUri] = useState('');
    const sourceUri = props.loadFromSiteUrl ? props.siteUrl || '' : htmlUri;
    const [webviewLoaded, setWebviewLoaded] = useState(false);
    const [navigationState, setNavigationState] = useState(initialNavigationState);
    const webViewRef = useRef<WebView>(null);

    useEffect(() => {
        props.onMessageFromRN((message) => {
            webViewRef.current?.injectJavaScript(`window.receiveMessageFromRN(${JSON.stringify(message)}); true;`);
        });
    }, [props.onMessageFromRN]);

    useEffect(() => {
        const loadHtml = async () => {
            if (props.loadFromSiteUrl) {
                return;
            }

            if (!props.assetModules) {
                props.onWebViewError?.(new Error('assetModules are required when loadFromSiteUrl is false'));
                return;
            }

            try {
                const {htmlFilePath} = await loadBundledWebAppAssets({
                    assetModules: props.assetModules,
                    transformHtml: props.transformHtml,
                });
                setHtmlUri(htmlFilePath);
            } catch (error) {
                props.onWebViewError?.(error);
                console.error(error);
            }
        };

        loadHtml();
    }, [props.assetModules, props.transformHtml, props.onWebViewError, props.loadFromSiteUrl]);

    useEffect(() => {
        if (!props.spaRoute) {
            return;
        }

        webViewRef.current?.injectJavaScript(`window.spaNavigate("${props.spaRoute.route}"); true;`);
    }, [props.spaRoute]);

    useEffect(() => {
        if (!webviewLoaded || !sourceUri || navigationState.loading) {
            return;
        }

        const timeout = setTimeout(async () => {
            await (props.hideSplashScreen || SplashScreen.hideAsync)();
        }, props.splashHideDelayMs ?? 500);

        return () => {
            clearTimeout(timeout);
        };
    }, [webviewLoaded, sourceUri, navigationState.loading, props.hideSplashScreen, props.splashHideDelayMs]);

    useBackNavigation(webViewRef);

    if (!props.engine) {
        return null;
    }

    if (!sourceUri) {
        return <View style={styles.webview} />;
    }

    return (
        <>
            <WebView
                onNavigationStateChange={(state: {canGoBack: boolean; canGoForward: boolean; loading: boolean; url: string}) => {
                    if (
                        navigationState.canGoBack !== state.canGoBack
                        || navigationState.canGoForward !== state.canGoForward
                        || navigationState.loading !== state.loading
                    ) {
                        setNavigationState({
                            canGoBack: state.url.includes('#') ? state.canGoBack : false,
                            canGoForward: state.canGoForward,
                            loading: state.loading,
                        });
                    }
                }}
                onLoadEnd={() => {
                    setWebviewLoaded(true);
                }}
                source={{uri: sourceUri}}
                allowingReadAccessToURL={!props.loadFromSiteUrl && htmlUri ? htmlUri.replace(/[^/]+$/, '') : undefined}
                onMessage={(event: {nativeEvent: {data: string}}) => {
                    props.handleMessageFromWebview(event.nativeEvent.data);
                }}
                ref={webViewRef}
                originWhitelist={['*']}
                style={styles.webview}
                key={nonce}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                webviewDebuggingEnabled={true}
                domStorageEnabled={true}
                allowFileAccess={!props.loadFromSiteUrl}
                allowFileAccessFromFileURLs={!props.loadFromSiteUrl}
                onError={(syntheticEvent: {nativeEvent: unknown}) => {
                    console.warn('WebView error: ', syntheticEvent.nativeEvent);
                    props.onWebViewError?.(syntheticEvent.nativeEvent);
                }}
                onShouldStartLoadWithRequest={props.onShouldStartLoadWithRequest}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                allowUniversalAccessFromFileURLs={!props.loadFromSiteUrl}
                allowsAirPlayForMediaPlayback={true}
                allowsBackForwardNavigationGestures={true}
                allowsFullscreenVideo={true}
                allowsProtectedMedia={true}
                onContentProcessDidTerminate={() => {
                    webViewRef.current?.reload();
                }}
                bounces={false}
                overScrollMode='never'
            />
        </>
    );
};

const styles = StyleSheet.create({
    webview: {
        flex: 1,
        backgroundColor: '#fff',
    },
});

const useBackNavigation = (webViewRef: React.RefObject<WebView | null>) => {
    useEffect(() => {
        const onBackPress = () => {
            if (webViewRef.current) {
                webViewRef.current.goBack();
                return true;
            }

            return false;
        };

        const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => {
            sub.remove();
        };
    }, [webViewRef]);
};
