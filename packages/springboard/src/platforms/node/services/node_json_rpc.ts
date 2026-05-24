import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';
import WebSocket from 'isomorphic-ws';
import ReconnectingWebSocket from 'reconnecting-websocket';

import {KVStore, Rpc, RpcArgs} from '../../../core/index.js';

type ClientParams = {
    clientId: string;
}

export class NodeJsonRpcClientAndServer implements Rpc {
    rpcClient!: JSONRPCClient<ClientParams>;
    rpcServer!: JSONRPCServer;

    constructor (private url: string, private sessionStore: KVStore) {}

    private clientId = '';

    public role = 'client' as const;

    initialize = async (): Promise<boolean> => {
        this.clientId = await this.getClientId();

        this.rpcServer = new JSONRPCServer();

        await new Promise(r => setTimeout(r, 1000));

        const connected = await this.initializeWebsocket();
        return connected;
    };

    private getClientId = async () => {
        if (this.clientId) {
            return this.clientId;
        }

        const fromStorage = await this.sessionStore.get<string>('ws-client-id');
        if (fromStorage) {
            this.clientId = fromStorage;
            return this.clientId;
        }

        const newClientId = Math.random().toString().slice(2);
        this.clientId = newClientId;

        await this.sessionStore.set('ws-client-id', newClientId);

        return this.clientId;
    };

    registerRpc = <Args, Return>(method: string, cb: (args: Args) => Promise<Return>) => {
        this.rpcServer.addMethod(method, async (args) => {
            const result = await cb(args);
            // console.log(`received RPC call for ${method}. Returned:`, result)
            return result;
        });
    };

    callRpc = async <Return, Args>(method: string, args: Args): Promise<Return> => {
        // console.log('calling rpc', method, JSON.stringify(args));

        const params = {clientId: this.clientId};
        const result = await this.rpcClient.request(method, args, params);
        return result;
    };

    broadcastRpc = async <Args>(method: string, args: Args, _rpcArgs?: RpcArgs | undefined): Promise<void> => {
        // console.log('broadcasting rpc', method, JSON.stringify(args));

        const params = {clientId: this.clientId};
        return this.rpcClient.notify(method, args, params);
    };

    // TODO: if we fail to connect on startup, we should just exit the program with a friendly error
    // or at least not spit out the massive error object we currently do
    initializeWebsocket = async () => {
        const separator = this.url.includes('?') ? '&' : '?';
        const fullUrl = `${this.url}${separator}clientId=${this.clientId}`;
        const ws = new ReconnectingWebSocket(fullUrl, undefined, {WebSocket});

        ws.onmessage = async (event) => {
            const jsonMessage = JSON.parse(event.data.toString());

            if (jsonMessage.jsonrpc === '2.0' && jsonMessage.method) {
                // Handle incoming RPC requests coming from the server to run in this client
                const result = await this.rpcServer.receive(jsonMessage);
                if (result) {
                    (result as any).clientId = (jsonMessage as unknown as any).clientId;
                }
                ws.send(JSON.stringify(result));
            } else {
                // Handle incoming RPC responses after calling an rpc method on the server
                // console.log(jsonMessage);
                this.rpcClient.receive(jsonMessage);
            }
        };

        return new Promise<boolean>((resolve, _reject) => {
            let connected = false;

            ws.onopen = () => {
                connected = true;
                console.log('websocket connected');
                this.rpcClient = new JSONRPCClient(async (request) => {
                    request.clientId = this.clientId;
                    if (ws.readyState === WebSocket.OPEN) {
                        // console.log(request);
                        ws.send(JSON.stringify(request));
                        return Promise.resolve();
                    } else {
                        return Promise.reject(new Error('WebSocket is not open'));
                    }
                });
                resolve(true);
            };

            ws.onerror = async (e) => {
                if (!connected) {
                    // console.error('failed to connect to websocket');
                    this.rpcClient = new JSONRPCClient(() => {
                        return Promise.reject(new Error('WebSocket is not open'));
                    });
                    resolve(false);
                }

                console.error('Error with websocket', e);
            };
        });
    };
}
