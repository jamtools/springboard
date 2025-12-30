import React from 'react';

import springboard from 'springboard';

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        song_structures: SongStructuresModuleReturnValue;
    }
}

type SongStructuresModuleReturnValue = {

};

springboard.registerModule('song_structures', {}, async (moduleAPI): Promise<SongStructuresModuleReturnValue> => {
    return {};
});
