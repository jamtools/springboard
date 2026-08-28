import React from 'react';

import springboard from 'springboard';
import {ModuleAPI} from 'springboard/engine/module_api';
import {defineRoute, defineRoutes} from 'springboard/router';

type AwaitedRecord<Obj extends Record<string, Promise<any>>> = {
    [Key in keyof Obj]: Awaited<Obj[Key]>;
};

async function promiseAllObject<Obj extends Record<string, Promise<any>>>(
    obj: Obj
): Promise<AwaitedRecord<Obj>> {
    const entries = Object.entries(obj);
    const resolvedValues = await Promise.all(entries.map(([_, promise]) => promise));

    return Object.fromEntries(entries.map(([key], index) => [key, resolvedValues[index]])) as AwaitedRecord<Obj>;
}

const createStates = async (moduleAPI: ModuleAPI) => {
    const states = await moduleAPI.shared.createSharedStates({
        myState: 'initial state',
    });
    return {
        myState: states.myState,
    };
};

const createMacros = async (moduleAPI: ModuleAPI) => {
    return promiseAllObject({
        myMacro: moduleAPI.getModule('macro').createMacro(moduleAPI, '', 'midi_button_input', {}),
    });
};

type Actions = {
    changeTheThing: (args: {newValue: string}) => void;
}

springboard.registerModule('ModuleOrSnackTemplate', {}, async (moduleAPI): Promise<ModuleOrSnackTemplateModuleReturnValue> => {
    const states = await createStates(moduleAPI);
    const macros = await createMacros(moduleAPI);

    const actions: Actions = {
        changeTheThing: moduleAPI.internal.createAction('changeTheThing', {}, async ({newValue}) => {
            states.myState.setState(newValue);
        }),
    };

    const sub = macros.myMacro.subject.subscribe(() => {

    });
    // moduleAPI.onDestroy(sub.unsubscribe);

    return {
        routes: buildRoutes(states, macros, actions),
    };
});

type States = Awaited<ReturnType<typeof createStates>>;
type Macros = Awaited<ReturnType<typeof createMacros>>;

const buildRoutes = (states: States, macros: Macros, actions: Actions) => {
    const ModuleOrSnackTemplateRoute = () => {
        const myState = states.myState.useState();

        return (
            <div>
                My state: {myState.toString()}
                <button
                    onClick={() => actions.changeTheThing({
                        newValue: Math.random().toString().slice(2),
                    })}
                >
                    Change value
                </button>
            </div>
        );
    };

    return defineRoutes([
        defineRoute({
            path: '/modules/ModuleOrSnackTemplate',
            component: ModuleOrSnackTemplateRoute,
        }),
    ]);
};

declare module 'springboard/register' {
    interface RegisteredModules {
        ModuleOrSnackTemplate: ModuleOrSnackTemplateModuleReturnValue;
    }
}

type ModuleOrSnackTemplateModuleReturnValue = {
    routes: ReturnType<typeof defineRoutes>;
};
