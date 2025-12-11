import {CoreDependencies} from '../../../core/types/module_types';

import {NodeFileStorageService} from '../services/node_file_storage_service';
import {Springboard} from '../../../core/engine/engine';
import {ExtraModuleDependencies} from '../../../core/module_registry/module_registry';

const port = process.env.PORT || 1337;

export type NodeAppDependencies = Pick<CoreDependencies, 'rpc' | 'storage'> & Partial<CoreDependencies> & {
    injectEngine: (engine: Springboard) => void;
};

export const startNodeApp = async (deps: NodeAppDependencies): Promise<Springboard> => {
    const coreDeps: CoreDependencies = {
        log: console.log,
        showError: console.error,
        storage: deps.storage,
        files: new NodeFileStorageService(),
        isMaestro: () => true,
        rpc: deps.rpc,
    };

    Object.assign(coreDeps, deps);

    const extraDeps: ExtraModuleDependencies = {
    };

    const engine = new Springboard(coreDeps, extraDeps);

    await engine.initialize();
    deps.injectEngine(engine);
    return engine;
};
