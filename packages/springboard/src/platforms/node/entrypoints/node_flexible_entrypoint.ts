import {startNodeApp} from './main';

type Deps = Parameters<typeof startNodeApp>[0];

export default (deps: Deps) => {
    startNodeApp(deps).then(async engine => {
        await new Promise(() => {});
    });
};
