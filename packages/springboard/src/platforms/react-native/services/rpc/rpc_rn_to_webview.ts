import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';

import {Rpc, RpcArgs} from '../../../../core/types/module_types';

type ClientParams = {
    clientId: string;
}

type Props = {
    sendMessageToWebview: (message: string) => void;
    onReceiveMessageFromWebview: (cb: (message: string) => void) => void;
}

export class RpcRNToWebview implements Rpc {
    rpcClient?: JSONRPCClient<ClientParams>;
    rpcServer!: JSONRPCServer;

    public role = 'server' as const;

    constructor (private props: Props) {
        this.props.onReceiveMessageFromWebview((message: string) => {
            // console.log('(rpc) received message from webview', message);
            this.handleIncomingMessage(message);
        });

        this.rpcServer = new JSONRPCServer();

        this.rpcClient = new JSONRPCClient((request) => {
            request.clientId = this.getClientId();
            this.sendMessageToWebview(request);
        });
    }

    initialize = async (): Promise<boolean> => {
        return true;
    };

    private sendMessageToWebview = (jsonMessage: any) => {
        this.props.sendMessageToWebview(JSON.stringify({
            type: 'rpc',
            data: jsonMessage,
        }));
    };

    private handleIncomingMessage = async (message: string) => {
        const data = JSON.parse(message);
        const jsonMessage = data.data;

        if (!jsonMessage) {
            return;
        }

        if (jsonMessage.jsonrpc === '2.0' && jsonMessage.method) {
            const result = await this.rpcServer.receive(jsonMessage);
            if (result) {
                (result as any).clientId = (jsonMessage as unknown as any).clientId;
                this.sendMessageToWebview(result);
            }
        } else {
            this.rpcClient?.receive(jsonMessage);
        }
    };

    private clientId = '';

    getClientId = () => {
        if (this.clientId) {
            return this.clientId;
        }

        const newClientId = Math.random().toString().slice(2);
        this.clientId = newClientId;
        return this.clientId;
    };

    registerRpc = <Args, Return>(method: string, cb: (args: Args) => Promise<Return>) => {
        this.rpcServer.addMethod(method, async (args) => {
            const result = await cb(args);
            // console.log(method, args, result);
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
