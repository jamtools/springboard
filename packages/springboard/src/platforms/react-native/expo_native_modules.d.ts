import type React from 'react';

declare module 'react-native' {
    export const StyleSheet: {
        create<T extends Record<string, unknown>>(styles: T): T;
    };
    export const StatusBar: any;
    export const BackHandler: {
        addEventListener(eventName: string, handler: () => boolean): {remove(): void};
    };
    export const View: React.ComponentType<any>;
    export const Platform: {
        OS: string;
    };
    export const Linking: {
        openURL(url: string): Promise<void>;
    };
    export const useColorScheme: () => 'light' | 'dark' | null;
}

declare module 'react-native-webview' {
    import type React from 'react';

    export type WebViewMessageEvent = {
        nativeEvent: {
            data: string;
        };
    };

    export type WebViewErrorEvent = {
        nativeEvent: unknown;
    };

    export type WebViewNavigation = {
        canGoBack: boolean;
        canGoForward: boolean;
        loading: boolean;
        url: string;
    };

    export type WebViewProps = Record<string, unknown>;

    export class WebView extends React.Component<any> {
        goBack(): void;
        goForward(): void;
        reload(): void;
        injectJavaScript(script: string): void;
    }
}

declare module 'react-native-webview/lib/WebViewTypes' {
    export type ShouldStartLoadRequest = {
        url: string;
    };
}

declare module 'expo-asset' {
    export const Asset: {
        fromModule(moduleId: unknown): {
            localUri?: string | null;
            downloadAsync(): Promise<void>;
        };
        fromMetadata(metadata: {
            __packager_asset?: boolean;
            hash: string;
            fileHashes?: string[];
            name: string;
            type: string;
            width?: number | null;
            height?: number | null;
            scales: number[];
            httpServerLocation?: string;
        }): {
            localUri?: string | null;
            downloadAsync(): Promise<void>;
        };
    };
}

declare module 'expo-file-system' {
    export const Paths: {
        document: {
            uri: string;
        };
    };

    export class File {
        constructor(...uris: (string | File)[]);
        readonly uri: string;
        readonly exists: boolean;
        text(): Promise<string>;
        write(contents: string): void;
        copy(destination: File, options?: {overwrite?: boolean}): Promise<void>;
    }
}

declare module 'expo-splash-screen' {
    export function hideAsync(): Promise<void>;
}


declare module 'expo-auth-session' {
    export function makeRedirectUri(options?: {path?: string}): string;
}

declare module 'expo-web-browser' {
    export function maybeCompleteAuthSession(): void;
    export function openAuthSessionAsync(url: string, redirectUrl?: string): Promise<{type: string; url?: string}>;
    export function dismissBrowser(): Promise<void>;
}

declare module 'expo-device' {
    export const isDevice: boolean;
}

declare module 'expo-constants' {
    const Constants: {
        expoConfig?: {extra?: {eas?: {projectId?: string}}};
        easConfig?: {projectId?: string};
    };
    export default Constants;
}

declare module 'expo-notifications' {
    export type Notification = {
        request: {
            content: {
                title?: string | null;
                body?: string | null;
                data?: unknown;
            };
        };
    };

    export type NotificationResponse = {
        notification: Notification;
    };

    export type EventSubscription = {
        remove(): void;
    };

    export const AndroidImportance: {
        MAX: number;
    };

    export function setNotificationHandler(handler: {
        handleNotification(): Promise<{
            shouldShowAlert: boolean;
            shouldPlaySound: boolean;
            shouldSetBadge: boolean;
            shouldShowBanner: boolean;
            shouldShowList: boolean;
        }>;
    }): void;

    export function setNotificationChannelAsync(channelId: string, channel: {
        name: string;
        importance: number;
        vibrationPattern?: number[];
        lightColor?: string;
    }): Promise<void>;

    export function getPermissionsAsync(): Promise<{status: string}>;
    export function requestPermissionsAsync(): Promise<{status: string}>;
    export function getExpoPushTokenAsync(args: {projectId: string}): Promise<{data: string}>;
    export function addNotificationReceivedListener(listener: (notification: Notification) => void): EventSubscription;
    export function addNotificationResponseReceivedListener(listener: (response: NotificationResponse) => void): EventSubscription;
    export function removeNotificationSubscription(subscription: EventSubscription): void;
}

export {};
