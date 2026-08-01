export default `
import React from 'react';

import springboard from 'springboard';

export default springboard.defineModule('example', {}, async (app) => {
    app.registerRoute('/', {}, () => {
        return <h1>Example</h1>;
    });

    return {};
});
`;
