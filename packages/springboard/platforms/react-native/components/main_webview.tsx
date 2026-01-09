import React from 'react';

import {StyleSheet, View, BackHandler, useColorScheme} from 'react-native'

import {WebView} from 'react-native-webview';

import {useEffect, useRef, useState} from 'react';
import {Springboard} from 'springboard/engine/engine';

import Ionicons from '@expo/vector-icons/Ionicons';
import {ShouldStartLoadRequest} from 'react-native-webview/lib/WebViewTypes';

type Props = {
    spaRoute: {route: string} | null;
    engine: Springboard | null;
    handleMessageFromWebview: (message: string) => void;
    onMessageFromRN: (cb: (message: string) => void) => void;
    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => boolean;
    webAppUrl?: string; // Optional URL to load in webview
    showNavigation?: boolean; // Whether to show navigation buttons
}

const initialNavStatus = {
    canGoBack: false,
    canGoForward: false,
    loading: false,
};

export const MainWebview = (props: Props) => {
    const [nonce, setNonce] = useState(Math.random().toString());

    const webViewRef = useRef<WebView>(null);

    const {engine, handleMessageFromWebview, onMessageFromRN} = props;
    const showNavigation = props.showNavigation !== false; // Default to true
    const webAppUrl = props.webAppUrl || process.env.EXPO_PUBLIC_SITE_URL || 'https://springboard.app';

    const [navStatus, setNavStatus] = useState(initialNavStatus);

    useEffect(() => {
        onMessageFromRN(message => {
            webViewRef.current?.injectJavaScript(`window.receiveMessageFromRN && window.receiveMessageFromRN(${JSON.stringify(message)});`)
        });
    }, []);

    useBackNavigation(webViewRef);

    useEffect(() => {
        if (props.spaRoute) {
            webViewRef.current?.injectJavaScript(`window.spaNavigate && window.spaNavigate("${props.spaRoute.route}"); true;`);
        }
    }, [props.spaRoute]);

    const colorScheme = useColorScheme();
    const navIconColor = colorScheme === 'light' ? '#444' : '#aaa';
    const disabledNavIconColor = '#777';

    if (!engine) {
        return null;
    }

    return (
        <>
            {showNavigation && (
                <View style={styles.headerButtonsContainer}>
                    <View style={styles.navButtonsContainer}>
                        <Ionicons
                            name='arrow-back'
                            size={32}
                            color={navStatus.canGoBack ? navIconColor : disabledNavIconColor}
                            disabled={!navStatus.canGoBack}
                            onPress={() => {
                                if (!navStatus.canGoBack) {
                                    return;
                                }

                                if (webViewRef.current) {
                                    webViewRef.current.goBack();
                                    return true;
                                }
                            }}
                        />
                        {navStatus.canGoForward && (
                            <Ionicons
                                name='arrow-forward'
                                size={32}
                                disabled={!navStatus.canGoForward}
                                color={navStatus.canGoForward ? navIconColor : disabledNavIconColor}
                                onPress={() => {
                                    if (!navStatus.canGoForward) {
                                        return;
                                    }

                                    if (webViewRef.current) {
                                        webViewRef.current.goForward();
                                        return true;
                                    }
                                }}
                            />
                        )}
                    </View>
                    <Ionicons
                        name='refresh'
                        size={32}
                        color={navIconColor}
                        onPress={() => {
                            setNonce(Math.random().toString().slice(2))
                        }}
                    />
                </View>
            )}

            <WebView
                onNavigationStateChange={e => {
                    if (navStatus.canGoBack !== e.canGoBack || navStatus.canGoForward !== e.canGoForward || navStatus.loading !== e.loading) {
                        setNavStatus({
                            canGoBack: e.url.includes('#') ? e.canGoBack : false,
                            canGoForward: e.canGoForward,
                            loading: e.loading,
                        });
                    }
                }}
                source={{
                    uri: webAppUrl,
                }}
                onMessage={(event) => {
                    handleMessageFromWebview(event.nativeEvent.data);
                }}
                ref={webViewRef}
                originWhitelist={['*']}
                style={styles.webview}
                key={nonce}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                webviewDebuggingEnabled={true}
                domStorageEnabled={true}
                onError={(syntheticEvent) => {
                    const {nativeEvent} = syntheticEvent;
                    console.warn('WebView error: ', nativeEvent);
                }}
                onShouldStartLoadWithRequest={props.onShouldStartLoadWithRequest}
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                allowsBackForwardNavigationGestures={true}
                allowsFullscreenVideo={true}
                onContentProcessDidTerminate={() => {
                    webViewRef.current?.reload();
                }}
                bounces={false}
                overScrollMode='never'
            />
        </>
    );
}

const styles = StyleSheet.create({
    webview: {
        flex: 1,
    },
    headerButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 5,
        paddingRight: 5,
    },
    navButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    refreshButton: {
        width: 150
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

        BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => {
            BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        };
    }, []);
};