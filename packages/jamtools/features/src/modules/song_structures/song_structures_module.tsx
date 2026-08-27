import React from 'react';

import springboard from 'springboard';

declare module 'springboard/register' {
    interface RegisteredModules {
        song_structures: SongStructuresModuleReturnValue;
    }
}

type SongStructuresModuleReturnValue = {

};

springboard.registerModule('song_structures', {}, async (moduleAPI): Promise<SongStructuresModuleReturnValue> => {
    return {};
});
