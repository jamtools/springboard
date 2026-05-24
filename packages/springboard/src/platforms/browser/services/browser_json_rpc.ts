import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';
import {Rpc, RpcArgs} from '../../../core/types/module_types.js';

import ReconnectingWebSocket from 'reconnecting-websocket';

type ClientParams = {
    clientId: string;
}

export class BrowserJsonRpcClientAndServer implements Rpc {
    rpcClient?: JSONRPCClient<ClientParams>;
    rpcServer?: JSONRPCServer;

    public role = 'client' as const;

    constructor (private url: string, private rpcProtocol: 'http' | 'websocket' = 'http') {
        const params: Record<string, string> = {};
        const parsedUrl = new URL(this.url);
        const keys = Array.from(parsedUrl.searchParams.keys());
        for (const key of keys) {
            params[key] = parsedUrl.searchParams.get(key)!;
        }

        this.latestQueryParams = params;
    }

    private clientId = '';
    private ws?: ReconnectingWebSocket;
    private latestQueryParams?: Record<string, string>;

    getClientId = () => {
        if (this.clientId) {
            return this.clientId;
        }

        const fromStorage = sessionStorage.getItem('ws-client-id');
        if (fromStorage) {
            this.clientId = fromStorage;
            return this.clientId;
        }

        const newClientId = Math.random().toString().slice(2);
        this.clientId = newClientId;
        return this.clientId;
    };

    registerRpc = <Args, Return>(method: string, cb: (args: Args) => Promise<Return>) => {
        this.rpcServer?.addMethod(method, async (args) => {
            const result = await cb(args);
            // console.log(`received RPC call for ${method}. Returned:`, result)
            return result;
        });
    };

    callRpc = async <Return, Args>(method: string, args: Args): Promise<Return> => {
        // console.log('calling rpc', method, JSON.stringify(args));

        const params = {clientId: this.getClientId()};
        const result = await this.rpcClient?.request(method, args, params);
        return result;
    };

    broadcastRpc = async <Args>(method: string, args: Args, _rpcArgs?: RpcArgs | undefined): Promise<void> => {
        if (!this.rpcClient) {
            // throw new Error(`tried to broadcast rpc but not connected to websocket`);
            return;
        }

        // console.log('broadcasting rpc', method, JSON.stringify(args));

        const params = {clientId: this.getClientId()};
        return this.rpcClient.notify(method, args, params);
    };

    // retrying = false;

    initializeWebsocket = async () => {
        const forceError = false;
        if (forceError) {
            return false;
        }

        const queryParamSeparator = this.url.includes('?') ? '&' : '?';
        const fullUrl = `${this.url}${queryParamSeparator}clientId=${this.getClientId()}`;
        // const ws = new WebSocket(fullUrl);
        const ws = new ReconnectingWebSocket(fullUrl, undefined, {WebSocket});
        this.ws = ws;

        ws.onmessage = async (event) => {
            const jsonMessage = JSON.parse(event.data);
            if (!jsonMessage) {
                return;
            }

            if (jsonMessage.jsonrpc === '2.0' && jsonMessage.method) {
                // Handle incoming RPC requests coming from the server to run in this client
                const result = await this.rpcServer?.receive(jsonMessage);
                if (result) {
                    (result as any).clientId = (jsonMessage as unknown as any).clientId;
                }
                ws.send(JSON.stringify(result));
            } else {
                // Handle incoming RPC responses after calling an rpc method on the server
                // console.log(jsonMessage);
                this.rpcClient?.receive(jsonMessage);
            }
        };

        return new Promise<boolean>((resolve, _reject) => {
            let connected = false;

            ws.onopen = () => {
                connected = true;
                console.log('websocket connected');

                // conditionally use websockets if the rpc protocol is set to websocket
                if (this.rpcProtocol === 'websocket') {
                    this.rpcClient = new JSONRPCClient((request) => {
                        request.clientId = this.getClientId();
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(request));
                            return Promise.resolve();
                        } else {
                            return Promise.reject(new Error('WebSocket is not open'));
                        }
                    });
                }
                resolve(true);
            };

            ws.onerror = async (e) => {
                if (!connected) {
                    console.error('failed to connect to websocket');
                    if (this.rpcProtocol === 'websocket') {
                        this.rpcClient = new JSONRPCClient(() => {
                            return Promise.reject(new Error('WebSocket is not open'));
                        });
                    }
                    resolve(false);
                }

                console.error('Error with websocket', e);
            };
        });
    };

    initialize = async (): Promise<boolean> => {
        this.rpcServer = new JSONRPCServer();

        // conditionally use http if the rpc protocol is set to http
        if (this.rpcProtocol === 'http') {
            this.rpcClient = new JSONRPCClient(async (request) => {
                const data = await this.sendHttpRpcRequest(request);
                this.rpcClient?.receive(data);
            });
        }

        try {
            return this.initializeWebsocket();
        } catch (e) {
            // console.error(`failed to connect to websocket server`, e);
            return false;
        }
    };

    reconnect = async (queryParams?: Record<string, string>): Promise<boolean> => {
        this.ws?.close();
        this.latestQueryParams = queryParams || this.latestQueryParams;

        const u = new URL(this.url);

        if (this.latestQueryParams) {
            for (const key of Object.keys(this.latestQueryParams)) {
                u.searchParams.set(key, this.latestQueryParams[key]!);
            }
        }

        this.url = u.toString();

        return this.initializeWebsocket();
    };

    private sendHttpRpcRequest = async (req: object & {method?: string}) => {
        const needToReconnectWebsocket = false;
        if (needToReconnectWebsocket) {
            this.ws?.reconnect();
        }

        let method = '';
        const originalMethod = req.method;
        if (originalMethod) {
            method = originalMethod.split('|').pop()!;
        }

        const u = new URL(this.url);
        u.pathname += '/rpc' + (method ? `/${method}` : '');

        if (this.latestQueryParams) {
            for (const key of Object.keys(this.latestQueryParams)) {
                u.searchParams.set(key, this.latestQueryParams[key]!);
            }
        }

        const rpcUrl = u.toString().replace('ws', 'http').replace('/ws', '');

        try {

            const res = await fetch(rpcUrl, {
                method: 'POST',
                body: JSON.stringify(req),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
                try {
                    const text = await res.text();
                    errorMessage += ` - ${text}`;
                } catch (e) {
                    // Ignore error reading response body
                }
                console.error(`RPC request failed for method '${originalMethod}':`, errorMessage);
                throw new Error(`RPC request failed: ${errorMessage}`);
            }

            const data = await res.json();
            return data;
        } catch (e) {
            console.error(`Error with RPC request for method '${originalMethod}':`, e);
            throw e;
        }
    };
}
