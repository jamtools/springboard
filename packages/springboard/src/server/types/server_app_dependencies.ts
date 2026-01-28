import {CoreDependencies} from '../../core';

export type ServerAppDependencies = Pick<CoreDependencies, 'rpc' | 'storage'> & Partial<CoreDependencies>;
