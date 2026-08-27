import React from 'react';

export const Button = (props: {title: string; onPress: () => void}) => {
    return <button onClick={props.onPress}>{props.title}</button>;
};

export const Text = (props: React.PropsWithChildren<{testID?: string; role?: string}>) => {
    return <span data-testid={props.testID} role={props.role}>{props.children}</span>;
};

export const View = (props: React.PropsWithChildren<{testID?: string; accessibilityLabel?: string}>) => {
    return (
        <div data-testid={props.testID} data-source={props.accessibilityLabel}>
            {props.children}
        </div>
    );
};
