import React from 'react';

import springboard from 'springboard';
import {defineRoute, defineRoutes} from 'springboard/router';

export default springboard.defineModule('example', {}, async (app) => {
    const ExampleRoute = () => {
        return <h1>Example</h1>;
    };

    return {
        routes: defineRoutes([
            defineRoute({path: '/', component: ExampleRoute}),
        ]),
    };
});
