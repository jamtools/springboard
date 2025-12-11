import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';

import {Rpc, RpcArgs} from '../../../../core/types/module_types';

type ClientParams = {
    clientId: string;
}

export class RpcWebviewToRN implements Rpc {
    rpcClient?: JSONRPCClient<ClientParams>;
    rpcServer!: JSONRPCServer;

    public role = 'client' as const;

    constructor (private props: {postMessage: (message: string) => void}) {
        this.rpcServer = new JSONRPCServer();

        this.rpcClient = new JSONRPCClient((request) => {
            request.clientId = this.getClientId();
            this.sendMessageToRN(request);
        });

        (window as any).receiveMessageFromRN = (message: string) => {
            this.handleIncomingMessage(message);
        };
    }

    initialize = async (): Promise<boolean> => {
        return true;
    };

    private sendMessageToRN = (jsonMessage: any) => {
        this.props.postMessage(JSON.stringify({
            type: 'rpc',
            data: jsonMessage,
        }));
    };

    public handleIncomingMessage = async (message: string) => {
        const data = JSON.parse(message);
        const jsonMessage = data.data;

        if (jsonMessage.jsonrpc === '2.0' && jsonMessage.method) {
            // Handle incoming RPC requests coming from the server to run in this client
            const result = await this.rpcServer.receive(jsonMessage);
            if (result) {
                (result as any).clientId = (jsonMessage as unknown as any).clientId;
            }

            this.sendMessageToRN(result);
            // ws.send(JSON.stringify(result));
        } else {
            this.rpcClient?.receive(jsonMessage);
        }
    };

    private clientId = '';

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
        this.rpcServer.addMethod(method, async (args) => {
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
}
