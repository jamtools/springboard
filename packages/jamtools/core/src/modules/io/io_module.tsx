import {Subject} from 'rxjs';

import springboard, {CoreDependencies, Module, ModuleAPI, ModuleDependencies, StateSupervisor} from 'springboard';
import {MidiInputEventPayload, QwertyCallbackPayload} from '@jamtools/core/types/io_types';
import {MidiEvent} from '@jamtools/core/modules/macro_module/macro_module_types';
import {createIoDependencies as defaultCreateIoDependencies} from '@jamtools/core/modules/io/io_dependencies';

import type {IoDeps, CreateIoDependencies} from './io_dependencies_types.js';

// Wrapper object to allow mutation for testing
const ioDepsConfig = {
    createIoDependencies: defaultCreateIoDependencies
};

export const setIoDependencyCreator = (func: CreateIoDependencies) => {
    // This is used for testing to override the platform-specific implementation
    ioDepsConfig.createIoDependencies = func;
};

type IoState = {
    midiInputDevices: string[];
    midiOutputDevices: string[];
};

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
        this.ioDeps = await ioDepsConfig.createIoDependencies();

        this.qwertyInputSubject = this.ioDeps.qwerty.onInputEvent;
        this.midiInputSubject = this.ioDeps.midi.onInputEvent;
        this.midiDeviceStatusSubject = this.ioDeps.midi.onDeviceStatusChange;

        // const inputs = this.ioDeps.midi.getInputs();
        // const outputs = this.ioDeps.midi.getOutputs();

        const state: IoState = {
            midiInputDevices: [],
            midiOutputDevices: [],
        };

        const sharedStates = await moduleAPI.shared.createSharedStates({
            plugged_in_midi_devices: state
        });
        this.midiDeviceState = sharedStates.plugged_in_midi_devices;
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

export const ioModule = springboard.defineModule('io', {}, async (moduleAPI) => {
    const mod = new IoModule(moduleAPI.internal.coreDeps, moduleAPI.internal.modDeps);
    await mod.initialize(moduleAPI);
    return mod;
});
