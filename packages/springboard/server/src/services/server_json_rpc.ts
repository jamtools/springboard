import {JSONRPCClient, JSONRPCServer} from 'json-rpc-2.0';

import {Rpc, RpcArgs} from 'springboard/types/module_types';

type ServerJsonRpcClientAndServerInitArgs = {
    broadcastMessage: (message: string) => void;
}

export class ServerJsonRpcClientAndServer implements Rpc {
    rpcClient: JSONRPCClient;
    rpcServer: JSONRPCServer;

    public role = 'server' as const;

    constructor(private initArgs: ServerJsonRpcClientAndServerInitArgs) {
        this.rpcServer = new JSONRPCServer();
        this.rpcClient = new JSONRPCClient(async (request) => {
            this.initArgs.broadcastMessage(JSON.stringify(request));
        });
    }

    initialize = async (): Promise<boolean> => {
        return true;
    };

    registerRpc = <Args, Return>(method: string, cb: (args: Args, middlewareResults?: unknown) => Promise<Return>) => {
        this.rpcServer.addMethod(method, async (args) => {
            if (args) {
                const {middlewareResults, ...rest} = args;
                const result = await cb(rest, middlewareResults);
                return result;
            }

            return cb(args, undefined);
        });
    };

    callRpc = async <Return, Args>(method: string, args: Args): Promise<Return> => {
        const result = await this.rpcClient.request(method, args);
        return result;
    };

    broadcastRpc = async <Args>(method: string, args: Args, _rpcArgs?: RpcArgs | undefined): Promise<void> => {
        return this.rpcClient.notify(method, args);
    };

    public processRequest = async (jsonMessageStr: string, middlewareResults: unknown) => {
        const jsonMessage = JSON.parse(jsonMessageStr);
        if (typeof jsonMessage === 'object' && jsonMessage !== null && 'params' in jsonMessage) {
            jsonMessage.params.middlewareResults = middlewareResults;
        }

        const result = await this.rpcServer.receive(jsonMessage);
        if (result) {
            (result as any).clientId = (jsonMessage as unknown as any).clientId;
        }

        return JSON.stringify(result);
    };
}
