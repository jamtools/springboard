import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';

import {Rpc, RpcArgs} from '../../../core/types/module_types';

type NodeLocalJsonRpcClientAndServerInitArgs = {
    broadcastMessage: (message: string) => void;
}

export class NodeLocalJsonRpcClientAndServer implements Rpc {
    rpcClient: JSONRPCClient;
    rpcServer: JSONRPCServer;

    public role = 'server' as const;

    constructor(private initArgs: NodeLocalJsonRpcClientAndServerInitArgs) {
        this.rpcServer = new JSONRPCServer();
        this.rpcClient = new JSONRPCClient(async (request) => {
            this.initArgs.broadcastMessage(JSON.stringify(request));
        });
    }

    initialize = async (): Promise<boolean> => {
        return true;
    };

    registerRpc = <Args, Return>(method: string, cb: (args: Args) => Promise<Return>) => {
        this.rpcServer.addMethod(method, async (args) => {
            const result = await cb(args);
            return result;
        });
    };

    callRpc = async <Return, Args>(method: string, args: Args): Promise<Return> => {
        const result = await this.rpcClient.request(method, args);
        return result;
    };

    broadcastRpc = async <Args>(method: string, args: Args, _rpcArgs?: RpcArgs | undefined): Promise<void> => {
        return this.rpcClient.notify(method, args);
    };

    public processRequest = async (jsonMessageStr: string) => {
        const jsonMessage = JSON.parse(jsonMessageStr);

        const result = await this.rpcServer.receive(jsonMessage);
        if (result) {
            (result as any).clientId = (jsonMessage as unknown as any).clientId;
        }

        return JSON.stringify(result);
    };
}
