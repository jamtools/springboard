import React from 'react';
import springboard from 'springboard';

import '@jamtools/core/modules/macro_module/macro_module';

springboard.registerModule('midi_thru', {}, async (moduleAPI) => {
    const macroModule = moduleAPI.getModule('macro');

    const {myInput, myOutput} = await macroModule.createMacros(moduleAPI, {
        myInput: {type: 'musical_keyboard_input', config: {}},
        myOutput: {type: 'musical_keyboard_output', config: {}},
    });

    myInput.subject.subscribe(evt => {
        myOutput.send(evt.event);
    });

    moduleAPI.ui.registerRoute('', {}, () => {
        return (
            <div>
                <myInput.components.edit/>
                <myOutput.components.edit/>
            </div>
        );
    });
});
