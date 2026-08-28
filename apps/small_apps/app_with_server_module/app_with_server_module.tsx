// @platform "node"
import {serverRegistry} from 'springboard/server/register';

serverRegistry.registerServerModule(async (api) => {
    api.hono.get('/hello', (c) => {
        return c.json({message: 'Hello from server module!'});
    });
});
// @platform end

import React, { useEffect } from 'react';

import springboard from 'springboard';
import {defineRoute, defineRoutes} from 'springboard/router';

springboard.registerModule('Main', {}, async (moduleAPI) => {
    const MainRoute = () => {
        useEffect(() => {
            fetch('/hello')
                .then(res => res.json())
                .then(data => {
                    console.log(data);
                });
        });

        return (
            <div>
                Yo
            </div>
        )
    };

    return {
        routes: defineRoutes([
            defineRoute({path: '/', component: MainRoute}),
        ]),
    };
});
