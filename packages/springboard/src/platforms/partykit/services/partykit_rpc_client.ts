import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';
import {Rpc, RpcArgs} from '../../../core/types/module_types';

import PartySocket from 'partysocket';

type ClientParams = {
    clientId: string;
}

export class PartyKitRpcClient implements Rpc {
    rpcClient?: JSONRPCClient<ClientParams>;
    rpcServer?: JSONRPCServer;

    public role = 'client' as const;

    private clientId = '';
    private conn!: PartySocket;
    private latestQueryParams?: Record<string, string>;

    constructor(private host: string, private room: string, queryParams?: Record<string, string>) {
        this.latestQueryParams = queryParams;
    }

    private getClientId = () => {
        if (this.clientId) {
            return this.clientId;
        }

        const fromStorage = sessionStorage.getItem('ws-client-id');
        if (fromStorage) {
            this.clientId = fromStorage;
            return this.clientId;
        }

        const newClientId = Math.random().toString().slice(2); // TODO: this should instead be server-assigned
        this.clientId = newClientId;
        return this.clientId;
    };

    public registerRpc = <Args, Return>(method: string, cb: (args: Args) => Promise<Return>) => {
        this.rpcServer?.addMethod(method, async (args) => {
            const result = await cb(args);
            return result;
        });
    };

    public callRpc = async <Return, Args>(method: string, args: Args): Promise<Return> => {
        const params = {clientId: this.getClientId()};
        const result = await this.rpcClient?.request(method, args, params);
        return result;
    };

    public broadcastRpc = async <Args>(method: string, args: Args, _rpcArgs?: RpcArgs | undefined): Promise<void> => {
        if (!this.rpcClient) {
            // throw new Error(`tried to broadcast rpc but not connected to websocket`);
            return;
        }

        const params = {clientId: this.getClientId()};
        return this.rpcClient.notify(method, args, params);
    };

    private initializeWebsocket = async () => {
        const forceError = false;
        if (forceError) {
            return false;
        }

        this.conn = new PartySocket({
            host: this.host,
            room: this.room,
            query: this.latestQueryParams,
        });

        const ws = this.conn;

        ws.onmessage = async (event) => {
            const jsonMessage = JSON.parse(event.data);

            if (jsonMessage.jsonrpc === '2.0' && jsonMessage.method) {
                // Handle incoming RPC requests coming from the server to run in this client
                const result = await this.rpcServer?.receive(jsonMessage);
                if (result) {
                    (result as any).clientId = (jsonMessage as unknown as any).clientId;
                }
                ws.send(JSON.stringify(result));
            } else {
                // Handle incoming RPC responses after calling an rpc method on the server
                this.rpcClient?.receive(jsonMessage);
            }
        };

        return new Promise<boolean>((resolve, _reject) => {
            let connected = false;

            ws.onopen = () => {
                connected = true;
                console.log('websocket connected');
                resolve(true);
            };

            ws.onerror = async (e) => {
                if (!connected) {
                    console.error('failed to connect to websocket');
                    resolve(false);
                }

                console.error('Error with websocket', e);
            };
        });
    };

    reconnect = async (queryParams?: Record<string, string>): Promise<boolean> => {
        this.conn.close();
        this.latestQueryParams = queryParams || this.latestQueryParams;
        return this.initializeWebsocket();
    };

    public initialize = async (): Promise<boolean> => {
        this.rpcServer = new JSONRPCServer();

        this.rpcClient = new JSONRPCClient(async (request) => {
            const data = await this.sendHttpRpcRequest(request);
            this.rpcClient?.receive(data);
        });

        try {
            return this.initializeWebsocket();
        } catch (e) {
            return false;
        }
    };

    private sendHttpRpcRequest = async (req: object & {method?: string}) => {
        const needToReconnectWebsocket = false;
        if (needToReconnectWebsocket) {
            this.conn?.reconnect();
        }

        let method = '';
        const originalMethod = req.method;
        if (originalMethod) {
            method = originalMethod.split('|').pop()!;
        }

        const u = new URL(this.conn.url);
        u.pathname += '/rpc' + (method ? `/${method}` : '');

        if (this.latestQueryParams) {
            for (const key of Object.keys(this.latestQueryParams)) {
                u.searchParams.set(key, this.latestQueryParams[key]);
            }
        }

        const rpcUrl = u.toString().replace('ws', 'http');
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
