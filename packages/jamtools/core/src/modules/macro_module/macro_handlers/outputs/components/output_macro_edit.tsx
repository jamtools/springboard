import React from 'react';

export const ALL_CHANNEL_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export type AddingOutputDeviceState = {
    device: string | null;
    channel: number | null;
    note?: number | null;
};

export type SavedOutputDeviceState = {
    device: string;
    channel: number;
    note?: number | null;
};

type EditProps = {
    onChooseNote?: (note: string) => void;
    editing: boolean;
    onEdit: () => void;
    onCancelEdit: () => void;
    availableMidiOutputs: string[];
    queuedDevice: AddingOutputDeviceState;
    savedDevices: SavedOutputDeviceState[];
    askToDelete: (savedDevice: SavedOutputDeviceState) => void;
    onChooseChannel: (channel: string) => void;
    onConfirm: () => void;
    onClickOutput: (device: string) => void;
    onClickSoundfont?: () => void;
};

export const Edit = (props: EditProps) => {
    if (!props.editing) {
        return (
            <div>
                <button
                    onClick={props.onEdit}
                >
                    Edit
                </button>
                {props.savedDevices.length}
            </div>
        );
    }

    return (
        <div>
            <button
                onClick={props.onCancelEdit}
            >
                Cancel
            </button>

            <SavedOutputs
                askToDelete={props.askToDelete}
                savedDevices={props.savedDevices}
            />

            <QueuedDevice
                queuedDevice={props.queuedDevice}
                onChooseNote={props.onChooseNote}
                onChooseChannel={props.onChooseChannel}
                onConfirm={props.onConfirm}
            />

            <AvailableOutputs
                availableMidiOutputs={props.availableMidiOutputs}
                onClickOutput={props.onClickOutput}
                onClickSoundfont={props.onClickSoundfont}
            />
        </div>
    );
};

type AvailableOutputsProps = {
    availableMidiOutputs: string[];
    onClickOutput: (output: string) => void;
    onClickSoundfont?: () => void;
}

const AvailableOutputs = (props: AvailableOutputsProps) => {
    return (
        <div>
            Available outputs:
            <ul>
                {props.availableMidiOutputs.map(output => (
                    <li
                        onClick={() => props.onClickOutput(output)}
                        key={output}
                    >
                        <pre>{output}</pre>
                    </li>
                ))}
                {props.onClickSoundfont && (
                    <li
                        onClick={() => props.onClickSoundfont!()}
                    >
                        <pre>
                            Soundfont
                        </pre>
                    </li>
                )}
            </ul>
        </div>
    );
};

type QueuedDeviceProps = {
    queuedDevice: AddingOutputDeviceState;
    onChooseNote?: (note: string) => void;
    onChooseChannel: (channel: string) => void;
    onConfirm: () => void;
}

const QueuedDevice = (props: QueuedDeviceProps) => {
    let enableConfirmButton = false;
    if (props.onChooseNote) {
        enableConfirmButton = Boolean(props.queuedDevice.device && props.queuedDevice.channel && props.queuedDevice.note);
    } else {
        enableConfirmButton = Boolean(props.queuedDevice.device && (props.queuedDevice.channel || props.queuedDevice.channel === 0));
    }

    return (
        <div>
            Queued device: {props.queuedDevice.device || 'none'}
            {props.queuedDevice.device && (
                <div>

                    <div>
                        <select
                            onChange={e => {
                                const value = e.currentTarget.value;
                                props.onChooseChannel(value);
                            }}
                            value={new String(props.queuedDevice.channel).toString()}
                        >
                            {ALL_CHANNEL_NUMBERS.map(n => (
                                <option
                                    key={n}
                                >
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>
                    {props.onChooseNote && (
                        <div>
                            <input
                                type='number'
                                onChange={(event) => props.onChooseNote!(event.target.value)}
                                value={props.queuedDevice.note?.toString()}
                            />
                        </div>
                    )}
                    <div>
                        {enableConfirmButton && (
                            <button
                                onClick={() => props.onConfirm()}
                            >
                                Confirm
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

type SavedOutputsProps = {
    savedDevices: SavedOutputDeviceState[];
    askToDelete: (state: SavedOutputDeviceState) => void;
}

const SavedOutputs = (props: SavedOutputsProps) => {
    return (
        <div>
            Saved outputs:
            <ul>
                {props.savedDevices.map(savedDevice => (
                    <li
                        key={savedDevice.device + '|' + savedDevice.channel}
                        onClick={() => props.askToDelete(savedDevice)}
                    >
                        {savedDevice.device} {' - '} {savedDevice.channel} {Boolean(savedDevice.note) && <>{' - '} {savedDevice.note}</>}
                    </li>
                ))}
            </ul>
        </div>
    );
};
