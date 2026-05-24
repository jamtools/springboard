import React from 'react';

import {Springboard, SpringboardProvider} from '../../../core/engine/engine.js';

import {FrontendRoutes} from '../frontend_routes.js';

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
