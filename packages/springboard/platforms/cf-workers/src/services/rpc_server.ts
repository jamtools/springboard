import {Context} from 'hono';
import {RoomLike} from '../hono_app';
import {RpcMiddleware} from 'springboard-server/src/register';

type SharedJsonRpcServerInitArgs = {
    processRequest: (message: string, middlewareResult: unknown) => Promise<string>;
    rpcMiddlewares: RpcMiddleware[];
}

export class SharedJsonRpcServer {
    constructor(private initArgs: SharedJsonRpcServerInitArgs, private room: RoomLike) { }

    public broadcastMessage = (message: string) => {
        this.room.broadcast(message);
    };

    public onMessage = async (message: string, conn: any) => {
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

        return this.initArgs.processRequest(message, rpcContext);

    };
}
