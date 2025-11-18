// @platform "node"
import {serverRegistry} from 'springboard-server/src/register';

serverRegistry.registerServerModule(async (api) => {
    api.hono.get('/hello', (c) => {
        return c.json({message: 'Hello from server module!'});
    });
});
// @platform end

import React, { useEffect } from 'react';

import springboard from 'springboard';

springboard.registerModule('Main', {}, async (moduleAPI) => {
    moduleAPI.registerRoute('/', {}, () => {
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
    });

    return {};
});