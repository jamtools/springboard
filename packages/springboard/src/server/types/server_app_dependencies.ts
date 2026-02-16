import {CoreDependencies} from '../../core/index.js';

export type ServerAppDependencies = Pick<CoreDependencies, 'rpc' | 'storage'> & Partial<CoreDependencies>;
