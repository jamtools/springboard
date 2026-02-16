
import React from 'react';

import springboard from 'springboard';

springboard.registerModule('example', {}, async (app) => {
    app.registerRoute('/', {}, () => {
        return <h1>Example</h1>;
    });

    return {

    };
})
