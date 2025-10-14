import {CoreDependencies} from 'springboard/types/module_types';

export type ServerAppDependencies = Pick<CoreDependencies, 'rpc' | 'storage'> & Partial<CoreDependencies>;
