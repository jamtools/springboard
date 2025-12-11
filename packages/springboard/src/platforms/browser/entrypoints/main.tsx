import React from 'react';

import {Springboard, SpringboardProvider} from '../../../core/engine/engine';

import {FrontendRoutes} from '../frontend_routes';

type Props = {
    engine: Springboard;
}

export const Main = (props: Props) => {
    return (
        <SpringboardProvider engine={props.engine}>
            <FrontendRoutes/>
        </SpringboardProvider>
    );
};
