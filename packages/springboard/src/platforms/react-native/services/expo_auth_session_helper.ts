import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {Linking} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export type HandleExpoAuthSessionRequestOptions = {
    url: string;
    redirectPath: string;
    matchesAuthUrl: (url: URL) => boolean;
    onAuthSuccessUrl: (url: string) => void | Promise<void>;
    onAuthCancel?: () => void | Promise<void>;
    onAuthError?: (error: unknown) => void | Promise<void>;
    matchesInAppUrl?: (url: URL) => boolean;
    onInAppUrl?: (url: URL) => void | Promise<void>;
    openExternalUrl?: (url: string) => void | Promise<void>;
};

const getAppUrlScheme = () => {
    const appUrl = AuthSession.makeRedirectUri();
    return new URL(appUrl).protocol;
};

export const handleExpoAuthSessionRequest = (options: HandleExpoAuthSessionRequestOptions): boolean => {
    const parsedUrl = new URL(options.url);

    if (parsedUrl.protocol === 'file:') {
        return true;
    }

    if (parsedUrl.protocol === getAppUrlScheme()) {
        void options.onInAppUrl?.(parsedUrl);
        return false;
    }

    if (options.matchesAuthUrl(parsedUrl)) {
        void (async () => {
            try {
                const redirectUri = AuthSession.makeRedirectUri({path: options.redirectPath});
                const result = await WebBrowser.openAuthSessionAsync(options.url, redirectUri);

                if (result.type === 'success' && result.url) {
                    await options.onAuthSuccessUrl(result.url);
                    await WebBrowser.dismissBrowser();
                    return;
                }

                await options.onAuthCancel?.();
            } catch (error) {
                await options.onAuthError?.(error);
            }
        })();

        return false;
    }

    if (options.matchesInAppUrl?.(parsedUrl)) {
        void options.onInAppUrl?.(parsedUrl);
        return false;
    }

    void (options.openExternalUrl || Linking.openURL)(options.url);
    return false;
};
