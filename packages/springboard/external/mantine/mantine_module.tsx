// @platform "browser"

import React from 'react';

import springboard from 'springboard';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';

import {Box, Button, createTheme, Drawer, Group, MantineProvider as Mantine, Progress, Text} from '@mantine/core';
import {Notifications, notifications} from '@mantine/notifications';

springboard.registerModule('Mantine', {}, async (moduleAPI) => {
    moduleAPI.ui.registerReactProvider(MantineProvider);
});

const MantineProvider = (props: React.PropsWithChildren) => {
    return (
        <Mantine
            defaultColorScheme='dark'
        >
            <Notifications
                position='top-right'
                portalProps={{
                    target: document.body,
                }}
            />

            {props.children}
        </Mantine>
    );
};

// @platform end
