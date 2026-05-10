import {useEffect, useRef} from 'react';
import {Platform} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export type ExpoPushNotification<TData extends object = Record<string, unknown>> = {
    title?: string | null;
    body?: string | null;
    data?: TData;
};

export type UseExpoPushNotificationsProps<TData extends object = Record<string, unknown>> = {
    onNotificationPress: (notification: ExpoPushNotification<TData>) => void;
    onTokenFetched: (token: string) => void | Promise<void>;
    onTokenError: (error: string) => void;
    parseNotificationData?: (data: unknown) => TData | undefined;
    onNotificationReceived?: (notification: Notifications.Notification) => void;
    androidChannel?: {
        id: string;
        name: string;
        importance?: number;
        vibrationPattern?: number[];
        lightColor?: string;
    };
    projectId?: string;
};

const parseDefaultNotificationData = <TData extends object>(data: unknown): TData | undefined => {
    if (!data || typeof data !== 'object') {
        return undefined;
    }

    return data as TData;
};

const getProjectId = () => {
    return Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
};

const registerForPushNotificationsAsync = async (props: UseExpoPushNotificationsProps<any>) => {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(props.androidChannel?.id || 'default', {
            name: props.androidChannel?.name || 'default',
            importance: props.androidChannel?.importance ?? Notifications.AndroidImportance.MAX,
            vibrationPattern: props.androidChannel?.vibrationPattern ?? [0, 250, 250, 250],
            lightColor: props.androidChannel?.lightColor ?? '#FF231F7C',
        });
    }

    if (!Device.isDevice) {
        return;
    }

    const {status: existingStatus} = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const {status} = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        throw new Error('Permission not granted to get push token for push notification!');
    }

    const projectId = props.projectId ?? getProjectId();
    if (!projectId) {
        throw new Error('Project ID not found');
    }

    return (await Notifications.getExpoPushTokenAsync({projectId})).data;
};

export function useExpoPushNotifications<TData extends object = Record<string, unknown>>(props: UseExpoPushNotificationsProps<TData>) {
    const latestProps = useRef(props);
    latestProps.current = props;

    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    useEffect(() => {
        registerForPushNotificationsAsync(latestProps.current)
            .then(token => {
                if (token) {
                    void latestProps.current.onTokenFetched(token);
                }
            })
            .catch((error: unknown) => latestProps.current.onTokenError(String(error)));

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            latestProps.current.onNotificationReceived?.(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const content = response.notification.request.content;
            const parseData = latestProps.current.parseNotificationData || parseDefaultNotificationData<TData>;
            latestProps.current.onNotificationPress({
                title: content.title,
                body: content.body,
                data: parseData(content.data),
            });
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }

            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, []);

    return null;
}
