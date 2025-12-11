import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';

import {Module} from '../../module_registry/module_registry';

export type ModuleHookValue<M extends Module> = {
    mod: M;
    state: M['state'];
    getState: () => M['state'];
};

export class BaseModule {
    static Provider = <M extends Module>(mod: M, ctx: React.Context<ModuleHookValue<M>>) => function Provider(props: React.PropsWithChildren) {
        const [moduleStoredState, setModuleStoredState] = useState(mod.state);
        const moduleRefState = useRef(mod.state);

        useEffect(() => {
            mod.subject?.subscribe(state => {
                moduleRefState.current = state;
                setModuleStoredState(state);
            });

            return () => mod.subject?.unsubscribe();
        }, []);

        const value = useMemo(() => {
            return {
                mod,
                state: moduleStoredState,
                getState: () => moduleRefState.current,
            };
        }, [moduleStoredState]);

        return (
            <ctx.Provider value={value}>
                {props.children}
            </ctx.Provider>
        );
    };

    static useModule = <M extends Module>(ctx: React.Context<ModuleHookValue<M>>) => () => {
        const value = useContext(ctx);
        return value;
    };

    static setState = <M extends Module>(mod: M) => (state: Partial<M['state']>) => {
        const newState = {
            ...mod.state,
            ...state,
        };

        mod.state = newState;
        mod.subject?.next(newState);
    };
}
