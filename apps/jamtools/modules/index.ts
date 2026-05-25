import '@jamtools/core/modules';
import '@jamtools/features/modules';
import '@jamtools/features/snacks';

import springboard from 'springboard';

// @platform "browser"
import '@springboardjs/shoelace/shoelace_imports';
import {ShoelaceApplicationShell} from '@springboardjs/shoelace/components/shoelace_application_shell';

springboard.registerModule('UIMain', {}, async (moduleAPI) => {
    moduleAPI.ui.registerApplicationShell(ShoelaceApplicationShell);
});
// @platform end
