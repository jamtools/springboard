import {JSONRPCClient, JSONRPCRequest} from 'json-rpc-2.0';
import {Context} from 'hono';
import {WSContext, WSEvents} from 'hono/ws';
import {RpcMiddleware} from '../register';

import {rpcAsyncLocalStorage as nodeRpcAsyncLocalStorage} from '../../platforms/node/services/node_rpc_async_local_storage';

type WebsocketInterface = {
    send: (s: string) => void;
}

type NodeJsonRpcServerInitArgs = {
    processRequest: (message: string) => Promise<string>;
    rpcMiddlewares: RpcMiddleware[];
}

export class NodeJsonRpcServer {
    private incomingClients: {[clientId: string]: WebsocketInterface} = {};
    private outgoingClients: {[clientId: string]: JSONRPCClient} = {};

    constructor(private initArgs: NodeJsonRpcServerInitArgs) { }

    // New function: this will be used for async things like toasts
    // public sendMessage = (message: string, clientId: string) => {
    //     this.incomingClients[clientId]?.send(message);
    // };

    public broadcastMessage = (message: string) => {
        for (const c of Object.keys(this.incomingClients)) {
            this.incomingClients[c]?.send(message);
        }
    };

    public handleConnection = (c: Context): WSEvents => {
        let providedClientId = '';
        // let isMaestro = false;

        const incomingClients = this.incomingClients;
        const outgoingClients = this.outgoingClients;

        const req = c.req;

        if (req.url?.includes('?')) {
            const urlParams = new URLSearchParams(req.url.substring(req.url.indexOf('?')));
            providedClientId = urlParams.get('clientId') || '';
        }

        const clientId = providedClientId || `${Date.now()}`;

        let wsStored: WSContext | undefined;

        const client = new JSONRPCClient((request: JSONRPCRequest) => {
            if (wsStored?.readyState === WebSocket.OPEN) {
                wsStored.send(JSON.stringify(request));
                return Promise.resolve();
            } else {
                return Promise.reject(new Error('WebSocket is not open'));
            }
        });

        outgoingClients[clientId] = client;

        return {
            onOpen: (event, ws) => {
                incomingClients[clientId] = ws;
                wsStored = ws;
            },
            onMessage: async (event, ws) => {
                const message = event.data.toString();
                // console.log(message);

                const response = await this.processRequestWithMiddleware(c, message);
                if (!response) {
                    return;
                }

                ws.send(response);
            },
            onClose: () => {
                delete incomingClients[clientId];
                delete outgoingClients[clientId];
            },
        };
    };

    processRequestWithMiddleware = async (c: Context, message: string) => {
        if (!message) {
            return;
        }

        const jsonMessage = JSON.parse(message);
        if (!jsonMessage) {
            return;
        }

        if (jsonMessage.jsonrpc !== '2.0') {
            return;
        }

        if (!jsonMessage.method) {
            return;
        }

        const rpcContext: object = {};
        for (const middleware of this.initArgs.rpcMiddlewares) {
            try {
                const middlewareResult = await middleware(c);
                Object.assign(rpcContext, middlewareResult);
            } catch (e) {
                return JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonMessage.id,
                    error: (e as Error).message,
                });
            }
        }

        return new Promise<string>((resolve) => {
            nodeRpcAsyncLocalStorage.run(rpcContext, async () => {
                const response = await this.initArgs.processRequest(message);
                resolve(response);
            });
        });
    };
}
