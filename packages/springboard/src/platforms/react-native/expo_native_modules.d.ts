declare module 'react-native' {
    export const StyleSheet: {
        create<T extends Record<string, unknown>>(styles: T): T;
    };
    export const StatusBar: any;
    export const BackHandler: {
        addEventListener(eventName: string, handler: () => boolean): {remove(): void};
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
    };
}

declare module 'expo-file-system' {
    export const documentDirectory: string | null;
    export function readAsStringAsync(path: string): Promise<string>;
    export function copyAsync(args: {from: string; to: string}): Promise<void>;
    export function writeAsStringAsync(path: string, contents: string): Promise<void>;
}

declare module 'expo-splash-screen' {
    export function hideAsync(): Promise<void>;
}
