import {Subject} from 'rxjs';

import {CoreDependencies, ModuleDependencies} from 'springboard/types/module_types';
import {Module} from 'springboard/module_registry/module_registry';
import {MidiInputEventPayload, QwertyCallbackPayload} from '@jamtools/core/types/io_types';
import springboard from 'springboard';
import {StateSupervisor} from 'springboard/services/states/shared_state_service';
import {ModuleAPI} from 'springboard/engine/module_api';
import {MidiEvent} from '@jamtools/core/modules/macro_module/macro_module_types';

import type {IoDeps} from './io_dependencies';

let createIoDependencies: () => Promise<IoDeps>;

// @platform "browser"
import {createIoDependencies as browserDeps} from './io_dependencies.browser';
createIoDependencies = browserDeps;
// @platform end

// @platform "node"
import {createIoDependencies as nodeDeps} from './io_dependencies.node';
createIoDependencies = nodeDeps;
// @platform end

// @platform "default"
import {createIoDependencies as defaultDeps} from './io_dependencies';
createIoDependencies = defaultDeps;
// @platform end

export const setIoDependencyCreator = (func: typeof createIoDependencies) => {
    createIoDependencies = func;
};

type IoState = {
    midiInputDevices: string[];
    midiOutputDevices: string[];
};

springboard.registerClassModule((coreDeps: CoreDependencies, modDependencies: ModuleDependencies) => {
    return new IoModule(coreDeps, modDependencies);
});

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        io: IoModule;
    }
}

export class IoModule implements Module<IoState> {
    moduleId = 'io';

    cleanup: (() => void)[] = [];

    state: IoState = {
        midiInputDevices: [],
        midiOutputDevices: [],
    };

    qwertyInputSubject!: Subject<QwertyCallbackPayload>;
    midiInputSubject!: Subject<MidiInputEventPayload>;
    midiDeviceStatusSubject!: typeof this.ioDeps.midi.onDeviceStatusChange;

    midiDeviceState!: StateSupervisor<IoState>;

    private ioDeps!: IoDeps;
    private isMidiInitialized = false;

    constructor(private coreDeps: CoreDependencies, private moduleDeps: ModuleDependencies) {
    }

    ensureListening = async () => {
        if (this.isMidiInitialized) {
            return;
        }

        this.isMidiInitialized = true;
        await this.ioDeps.midi.initialize();

        const inputs = this.ioDeps.midi.getInputs();
        const outputs = this.ioDeps.midi.getOutputs();

        const state: IoState = {
            midiInputDevices: inputs,
            midiOutputDevices: outputs,
        };

        this.midiDeviceState.setState(state);
    };

    initialize = async (moduleAPI: ModuleAPI) => {
        this.ioDeps = await createIoDependencies();

        this.qwertyInputSubject = this.ioDeps.qwerty.onInputEvent;
        this.midiInputSubject = this.ioDeps.midi.onInputEvent;
        this.midiDeviceStatusSubject = this.ioDeps.midi.onDeviceStatusChange;

        // const inputs = this.ioDeps.midi.getInputs();
        // const outputs = this.ioDeps.midi.getOutputs();

        const state: IoState = {
            midiInputDevices: [],
            midiOutputDevices: [],
        };

        this.midiDeviceState = await moduleAPI.statesAPI.createSharedState('plugged_in_midi_devices', state);
    };

    public sendMidiEvent = (outputName: string, midiEvent: MidiEvent) => {
        this.ensureListening();
        this.ioDeps.midi.send(outputName, midiEvent);
    };

    onNewMidiDeviceFound = (deviceInfo: {name: string}) => {
        const existsInConfig = false;
        if (!existsInConfig) {
            this.moduleDeps.toast({
                target: 'all',
                message: `Found new midi device ${deviceInfo.name}. Want to configure it?`,
                variant: 'info',
                onClick: ['react_gotoMidiDeviceConfigPage', [deviceInfo.name]],
            });
        }
    };
}
