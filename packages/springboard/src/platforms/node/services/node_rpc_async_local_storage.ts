import {AsyncLocalStorage} from 'node:async_hooks';

export const nodeRpcAsyncLocalStorage = new AsyncLocalStorage();
