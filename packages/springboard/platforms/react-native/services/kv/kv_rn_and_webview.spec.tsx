import React, {act, useState} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import '@testing-library/jest-dom';

import {Springboard} from 'springboard/engine/engine';
import {makeMockCoreDependencies, makeMockExtraDependences} from 'springboard/test/mock_core_dependencies';
import springboard from 'springboard';
import {vitest} from 'vitest';

import {SpringboardRegistry} from 'springboard/engine/register';
import {createRNWebviewEngine} from '../../entrypoints/platform_react_native_browser';
import {Main} from '@springboardjs/platforms-browser/entrypoints/main';
import {createRNMainEngine} from '../../entrypoints/rn_app_springboard_entrypoint';

describe('KvRnWebview', () => {
    beforeEach(() => {
        springboard.reset();
    });

    it('should update UI when UserAgent state changes', async () => {
        const mockCoreDepsForRN = makeMockCoreDependencies({store: {}});
        const mockCoreDepsForWebview = makeMockCoreDependencies({store: {}});

        const mockRpcWebview = makeMockRpcInstance('client');
        const mockAsyncStorage = makeMockRNAsyncStorage();
        const mockRemoteRpcForRN = makeMockRpcInstance('client');

        const entrypoint = (sb: SpringboardRegistry | Springboard) => {
            sb.registerModule('Test', {}, async (m) => {
                const userAgentStates = await m.userAgent.createUserAgentStates({
                    myUserAgentState: {message: 'Hey'}
                });

                const actions = m.createActions({
                    changeValue: async (args: {value: string}) => {
                        userAgentStates.myUserAgentState.setState({message: args.value});
                    },
                });

                m.registerRoute('/', {}, () => {
                    const myState = userAgentStates.myUserAgentState.useState();

                    const [localState, setLocalState] = useState('');

                    return (
                        <div>
                            <input
                                data-testid={'test-input'}
                                value={localState}
                                onChange={e => setLocalState(e.target.value)}
                            />
                            <button
                                data-testid={'test-submit-action'}
                                onClick={async () => {
                                    await actions.changeValue({value: localState}, {mode: 'local'});
                                }}
                            >
                                Submit action
                            </button>
                            <button
                                data-testid={'test-submit-set-state'}
                                onClick={async () => {
                                    userAgentStates.myUserAgentState.setState({message: 'hardcoded'});
                                }}
                            >
                                Submit set state
                            </button>
                            <div data-testid={'test-message-output'}>
                                {myState.message}
                            </div>
                        </div>
                    );
                });
            });
        };

        entrypoint(springboard);

        const onMessageFromRN = (message: string) => {
            (window as any).receiveMessageFromRN(message);
        };

        const onMessageFromWebview = (message: string) => {
            rnEngine.handleMessageFromWebview(message);
        };

        const rnEngine = createRNMainEngine({
            remoteRpc: mockRemoteRpcForRN,
            remoteKv: mockCoreDepsForRN.storage.shared,
            onMessageFromRN,
            asyncStorageDependency: mockAsyncStorage,
        });

        await act(async () => {
            await rnEngine.engine.initialize();
        });

        springboard.reset();

        entrypoint(springboard);

        const webviewEngine = createRNWebviewEngine({
            remoteRpc: mockRpcWebview,
            remoteKv: mockCoreDepsForWebview.storage.shared,
            onMessageFromWebview,
        });

        render(
            <Main
                engine={webviewEngine}
            />
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });
        await new Promise(r => setTimeout(r, 10));

        expect(screen.getByTestId('test-message-output')).toBeInTheDocument();
        expect(screen.getByTestId('test-message-output').textContent).toEqual('Hey');

        await act(async () => {
            await userEvent.type(screen.getByTestId('test-input'), 'new value');
            await userEvent.click(screen.getByTestId('test-submit-action'));
        });

        expect(screen.getByTestId('test-message-output').textContent).toEqual('new value');

        await act(async () => {
            await userEvent.click(screen.getByTestId('test-submit-set-state'));
        });

        expect(screen.getByTestId('test-message-output').textContent).toEqual('hardcoded');
    });
});

const makeMockRpcInstance = (role: 'server' | 'client') => {
    return {
        broadcastRpc: vitest.fn(),
        callRpc: vitest.fn(),
        initialize: vitest.fn().mockResolvedValue(true),
        registerRpc: vitest.fn(),
        role,
    };
};

const makeMockRNAsyncStorage = () => {
    const items: Record<string, string> = {};

    return {
        getAllKeys: async () => Object.keys(items),
        getItem: async (key: string) => items[key],
        setItem: async (key: string, value: string) => {items[key] = value;},
    };
};
