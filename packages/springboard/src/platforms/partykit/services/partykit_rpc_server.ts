// TODO: make this an arbitrary store instead of specifically this one
import {rpcAsyncLocalStorage as nodeRpcAsyncLocalStorage} from '../../node/services/node_rpc_async_local_storage';
import {Context} from 'hono';
import {Connection, Room} from 'partykit/server';
import {RpcMiddleware} from '../../../server/register';

type PartykitJsonRpcServerInitArgs = {
    processRequest: (message: string) => Promise<string>;
    rpcMiddlewares: RpcMiddleware[];
}

export class PartykitJsonRpcServer {
    constructor(private initArgs: PartykitJsonRpcServerInitArgs, private room: Room) { }

    public broadcastMessage = (message: string) => {
        this.room.broadcast(message);
    };

    public onMessage = async (message: string, conn: Connection) => {
        // we switched to using http for rpc, so this is no longer used
    };

    public processRequestWithMiddleware = async (message: string, c: Context) => {
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
                console.error('Error with rpc middleware', e);

                return JSON.stringify({
                    jsonrpc: '2.0',
                    id: jsonMessage.id,
                    error: 'An error occurred',
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
