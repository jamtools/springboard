import {defineHooks} from 'crossws';
import type {Peer, Message as WSMessage} from 'crossws';

type ProcessRpcMessage = (message: string, peer: Peer) => Promise<string | void>;

export function createCommonWebSocketHooks(processRpcMessage?: ProcessRpcMessage) {
    return defineHooks({
        open: (peer: Peer) => {
            peer.subscribe('event');
        },

        message: async (peer: Peer, message: WSMessage) => {
            if (processRpcMessage) {
                const messageStr = message.text();
                const response = await processRpcMessage(messageStr, peer);
                if (response) {
                    peer.send(response);
                }
            }
        },

        close: (peer: Peer) => {
            peer.unsubscribe('event');
        },
    });
}
