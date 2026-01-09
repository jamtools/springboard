import {Subject} from 'rxjs';

import easymidi, {Channel} from 'easymidi';

import {MidiInputEventPayload, MidiService} from '@jamtools/core/types/io_types';
import {DeviceInfo, MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {NodeMidiDevicePollerService} from './node_midi/midi_poller';

export class NodeMidiService implements MidiService {
    private inputs: easymidi.Input[] = [];
    private outputs: easymidi.Output[] = [];
    private errorDevices: string[] = [];
    private pollService = new NodeMidiDevicePollerService();

    public onDeviceStatusChange = new Subject<DeviceInfo & {status: 'connected' | 'disconnected'}>();
    public onInputEvent = new Subject<MidiInputEventPayload>();

    private initialized = false;
    private consecutiveErrors = 0;
    private basePollInterval = 10000; // 10 seconds
    private maxPollInterval = 60000; // 60 seconds maximum
    private debugLoggingEnabled = process.env.ENABLE_MIDI_POLLER_DEBUG_LOGGING === 'true';

    private logDebug = (message: string, ...args: any[]) => {
        if (this.debugLoggingEnabled) {
            console.log(message, ...args);
        }
    };

    public initialize = async () => {
        console.log('[NodeMidiService] === INITIALIZATION START ===');
        this.logDebug('[NodeMidiService] Initializing...');

        // Check system MIDI capabilities - DEBUG ONLY (will remove after fixing)
        console.log('[DEBUG] === SYSTEM MIDI CAPABILITIES CHECK ===');
        const systemInputs = easymidi.getInputs();
        const systemOutputs = easymidi.getOutputs();
        console.log('[DEBUG] System MIDI inputs from easymidi.getInputs():', JSON.stringify(systemInputs));
        console.log('[DEBUG] System MIDI outputs from easymidi.getOutputs():', JSON.stringify(systemOutputs));
        console.log(`[DEBUG] Total inputs: ${systemInputs.length}, Total outputs: ${systemOutputs.length}`);

        // TEMPORARY: Clear error devices list to see the actual error
        console.log('[DEBUG] CLEARING ERROR DEVICES LIST FOR DEBUGGING');
        this.errorDevices = [];

        await this.pollService.initialize();
        this.logDebug('[NodeMidiService] Starting device polling...');
        await this.pollForConnectedDevices();
        console.log('[NodeMidiService] === INITIALIZATION COMPLETE ===');
    };

    public getInputs = () => {
        return this.inputs.map(i => i.name).filter(d => !d.startsWith('Midi Through') && !d.includes('RtMidi'));
    };

    public getOutputs = () => {
        return this.outputs.map(o => o.name).filter(d => !d.startsWith('Midi Through') && !d.includes('RtMidi'));
    };

    private initializeMidiInputDevice = (inputName: string) => {
        inputName = inputName.trim();
        console.log(`[DEBUG] === INITIALIZING INPUT DEVICE: "${inputName}" ===`);
        this.logDebug(`[NodeMidiService] Attempting to initialize MIDI input: ${inputName}`);

        console.log(`[DEBUG] Current error devices list: ${JSON.stringify(this.errorDevices)}`);
        console.log(`[DEBUG] Is device in error list? ${this.errorDevices.includes(inputName)}`);

        if (this.errorDevices.includes(inputName)) {
            console.log(`[DEBUG] SKIPPING - Device "${inputName}" is in error list`);
            this.logDebug(`[NodeMidiService] Skipping ${inputName} - previously failed`);
            return;
        }

        try {
            console.log(`[DEBUG] Checking for existing input with name "${inputName}"`);
            const existingInputIndex = this.inputs.findIndex(i => i.name === inputName);
            console.log(`[DEBUG] Existing input index: ${existingInputIndex}`);

            if (existingInputIndex !== -1) {
                console.log('[DEBUG] Found existing input, closing it first');
                const existingInput = this.inputs[existingInputIndex];
                existingInput?.close();
                this.inputs = [...this.inputs.slice(0, existingInputIndex), ...this.inputs.slice(existingInputIndex + 1)];
                console.log(`[DEBUG] Closed existing input, new inputs length: ${this.inputs.length}`);
            }

            // Find the correct easymidi port name that matches our device
            const availableInputs = easymidi.getInputs();
            console.log(`[DEBUG] Available easymidi inputs: ${JSON.stringify(availableInputs)}`);
            console.log(`[DEBUG] Looking for match with: "${inputName}"`);

            // Find input that contains our device name
            const matchingInput = availableInputs.find(portName =>
                portName.includes(inputName) || inputName.includes(portName.split(':')[1]?.trim() || '')
            );

            if (!matchingInput) {
                throw new Error(`No matching easymidi input found for "${inputName}". Available: ${availableInputs.join(', ')}`);
            }

            console.log(`[DEBUG] Using easymidi port name: "${matchingInput}"`);
            console.log(`[DEBUG] About to call new easymidi.Input("${matchingInput}")`);
            this.logDebug(`[NodeMidiService] Creating easymidi.Input for ${matchingInput}...`);
            const startTime = Date.now();
            const input = new easymidi.Input(matchingInput);
            const createTime = Date.now() - startTime;
            console.log(`[DEBUG] SUCCESS: Created easymidi.Input in ${createTime}ms`);
            this.logDebug(`[NodeMidiService] Created input in ${createTime}ms`);

            const publishMidiEvent = (event: MidiEvent) => {
                const fullEvent: MidiEventFull = {
                    event,
                    type: 'midi',
                    deviceInfo: {
                        type: 'midi',
                        subtype: 'midi_input',
                        name: input.name,
                        manufacturer: '',
                    },
                };

                this.onInputEvent.next(fullEvent);
            };

            const handleNoteEvent = (eventType: 'noteon' | 'noteoff', event: easymidi.Note) => {
                const midiEvent: MidiEvent = {
                    type: eventType,
                    channel: event.channel,
                    number: event.note,
                    velocity: event.velocity,
                };

                publishMidiEvent(midiEvent);
            };

            input.on('noteon', (event) => {
                if (event.velocity === 0) {
                    handleNoteEvent('noteoff', event);
                    return;
                }
                handleNoteEvent('noteon', event);
            });

            input.on('noteoff', (event) => {
                handleNoteEvent('noteoff', event);
            });

            // probably want to use a generic on MidiEvent and MidiEventFull for event types. to have accurate object shapes to expect
            input.on('cc', (event) => {
                const midiEvent: MidiEvent = {
                    type: 'cc',
                    channel: event.channel,
                    number: event.controller,
                    value: event.value,
                    velocity: 0,
                };

                publishMidiEvent(midiEvent);
            });

            this.inputs.push(input);
            this.logDebug(`[NodeMidiService] Successfully initialized MIDI input: ${input.name}. Total inputs: ${this.inputs.length}`);

        } catch (e) {
            const error = e as Error;
            console.error('failed to initialize midi input device', inputName, error.message);
            console.error('Full error object:', error);
            console.error('Error stack:', error.stack);

            // Check if it's a memory allocation error specifically
            if (error.message.includes('Cannot allocate memory') || error.message.includes('Failed to initialise RtMidi')) {
                console.warn('Memory allocation failed for MIDI device. Consider reducing polling frequency or restarting service.');
            }

            this.errorDevices.push(inputName);
        }
    };

    private initializeMidiOutputDevice = (outputName: string) => {
        outputName = outputName.trim();
        this.logDebug(`[NodeMidiService] Attempting to initialize MIDI output: ${outputName}`);
        if (this.errorDevices.includes(outputName)) {
            this.logDebug(`[NodeMidiService] Skipping ${outputName} - previously failed`);
            return;
        }

        try {
            const existingOutputIndex = this.outputs.findIndex(o => o.name === outputName);

            if (existingOutputIndex !== -1) {
                const existingOutput = this.outputs[existingOutputIndex];
                existingOutput?.close();
                this.outputs = [...this.outputs.slice(0, existingOutputIndex), ...this.outputs.slice(existingOutputIndex + 1)];
            }

            // Find the correct easymidi port name that matches our device
            const availableOutputs = easymidi.getOutputs();
            console.log(`[DEBUG] Available easymidi outputs: ${JSON.stringify(availableOutputs)}`);
            console.log(`[DEBUG] Looking for match with: "${outputName}"`);

            // Find output that contains our device name
            const matchingOutput = availableOutputs.find(portName =>
                portName.includes(outputName) || outputName.includes(portName.split(':')[1]?.trim() || '')
            );

            if (!matchingOutput) {
                throw new Error(`No matching easymidi output found for "${outputName}". Available: ${availableOutputs.join(', ')}`);
            }

            console.log(`[DEBUG] Using easymidi port name: "${matchingOutput}"`);
            this.logDebug(`[NodeMidiService] Creating easymidi.Output for ${matchingOutput}...`);
            const startTime = Date.now();
            const output = new easymidi.Output(matchingOutput);
            const createTime = Date.now() - startTime;
            this.logDebug(`[NodeMidiService] Created output in ${createTime}ms`);

            this.outputs.push(output);
            this.logDebug(`[NodeMidiService] Successfully initialized MIDI output: ${output.name}. Total outputs: ${this.outputs.length}`);
        } catch (e) {
            const error = e as Error;
            console.error('failed to initialize midi output device', outputName, error.message);
            console.error('Full error object:', error);
            console.error('Error stack:', error.stack);

            // Check if it's a memory allocation error specifically
            if (error.message.includes('Cannot allocate memory') || error.message.includes('Failed to initialise RtMidi')) {
                console.warn('Memory allocation failed for MIDI device. Consider reducing polling frequency or restarting service.');
            }

            this.errorDevices.push(outputName);
        }
    };

    public send = (deviceName: string, midiEvent: MidiEvent) => {
        deviceName = deviceName.trim();
        const output = this.outputs.find(device => device.name === deviceName);
        if (!output) {
            console.error('Error: attempted to send midi message to nonexistent midi output', deviceName);
            return;
        }

        if (midiEvent.type === 'noteon' || midiEvent.type === 'noteoff') {
            let velocity = midiEvent.velocity;
            if (velocity === undefined) {
                velocity = midiEvent.type === 'noteon' ? 100 : 0;
            }

            const note: easymidi.Note = {
                channel: midiEvent.channel as Channel,
                note: midiEvent.number,
                velocity,
            };

            output.send(midiEvent.type as 'noteon', note);
        } else if (midiEvent.type === 'cc') {
            const cc: easymidi.ControlChange = {
                channel: midiEvent.channel as Channel,
                controller: midiEvent.number,
                value: midiEvent.value!,
            };

            output.send(midiEvent.type, cc);
        } else if (midiEvent.type === 'program') {
            const program: easymidi.Program = {
                channel: midiEvent.channel as Channel,
                number: midiEvent.number,
            };

            output.send(midiEvent.type, program);
        }
    };

    private getMemoryUsage = (): number => {
        const usage = process.memoryUsage();
        return usage.heapUsed / 1024 / 1024; // MB
    };

    private pollForConnectedDevices = async () => {
        this.logDebug('[NodeMidiService] === Starting device poll cycle ===');
        try {
            const memoryBefore = this.getMemoryUsage();
            this.logDebug(`[NodeMidiService] Memory before polling: ${memoryBefore.toFixed(1)} MB`);

            const knownDevices = Array.from(new Set(
                this.inputs.map(i => i.name)
                    .concat(this.outputs.map(o => o.name))
                    .concat(this.errorDevices) // Include error devices so they don't get re-detected as "newly connected"
            ));
            this.logDebug(`[NodeMidiService] Current known devices: ${knownDevices.length} (inputs: ${this.inputs.length}, outputs: ${this.outputs.length}, errors: ${this.errorDevices.length})`);
            this.logDebug(`[NodeMidiService] Known device names: ${JSON.stringify(knownDevices)}`);
            this.logDebug(`[NodeMidiService] Error devices: ${JSON.stringify(this.errorDevices)}`);

            const pollStartTime = Date.now();
            const result = await this.pollService.pollForDevices(knownDevices);
            const pollDuration = Date.now() - pollStartTime;
            this.logDebug(`[NodeMidiService] Poll completed in ${pollDuration}ms`);

            const memoryAfter = this.getMemoryUsage();
            this.logDebug(`[NodeMidiService] Memory after polling: ${memoryAfter.toFixed(1)} MB (delta: ${(memoryAfter - memoryBefore).toFixed(1)} MB)`);

            this.logDebug(`[NodeMidiService] Processing ${result.newlyConnectedDevices.length} newly connected devices...`);
            for (const device of result.newlyConnectedDevices) {
                this.logDebug(`[NodeMidiService] New device: ${device.humanReadableName} (machine: ${device.machineReadableName})`);
                console.log(`[DEBUG] TRYING HUMAN READABLE NAME: "${device.humanReadableName}" instead of machine name: "${device.machineReadableName}"`);
                if (device.input) {
                    this.initializeMidiInputDevice(device.humanReadableName);
                }
                if (device.output) {
                    this.initializeMidiOutputDevice(device.humanReadableName);
                }
            }

            this.logDebug(`[NodeMidiService] Processing ${result.newlyDisconnectedDevices.length} disconnected devices...`);
            for (const device of result.newlyDisconnectedDevices) {
                this.logDebug(`[NodeMidiService] Disconnected device: ${device.humanReadableName}`);
                if (device.input) {
                    const index = this.inputs.findIndex(d => d.name === device.machineReadableName);
                    if (index !== -1) {
                        this.logDebug(`[NodeMidiService] Closing input: ${this.inputs[index].name}`);
                        this.inputs[index].close();
                        this.inputs = [...this.inputs.slice(0, index), ...this.inputs.slice(index + 1)];
                    }
                }
                if (device.output) {
                    const index = this.outputs.findIndex(d => d.name === device.machineReadableName);
                    if (index !== -1) {
                        this.logDebug(`[NodeMidiService] Closing output: ${this.outputs[index].name}`);
                        this.outputs[index].close();
                        this.outputs = [...this.outputs.slice(0, index), ...this.outputs.slice(index + 1)];
                    }
                }
            }

            if (result.newlyConnectedDevices.length || result.newlyDisconnectedDevices.length) {
                if (this.initialized) {
                    for (const device of result.newlyConnectedDevices) {
                        this.onDeviceStatusChange.next({
                            manufacturer: '',
                            name: device.humanReadableName,
                            status: 'connected',
                            subtype: 'midi_input',
                            type: 'midi',
                        });
                    }
                    for (const device of result.newlyDisconnectedDevices) {
                        this.onDeviceStatusChange.next({
                            manufacturer: '',
                            name: device.humanReadableName,
                            status: 'disconnected',
                            subtype: 'midi_input',
                            type: 'midi',
                        });
                    }
                }
            }

            this.initialized = true;
            this.consecutiveErrors = 0; // Reset error count on successful poll
            this.logDebug(`[NodeMidiService] Poll cycle completed successfully. Active inputs: ${this.inputs.length}, Active outputs: ${this.outputs.length}`);

        } catch (error) {
            this.consecutiveErrors++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[NodeMidiService] Polling error (${this.consecutiveErrors} consecutive): ${errorMsg}`);
            this.logDebug('[NodeMidiService] Full error:', error);

            if (errorMsg.includes('Cannot allocate memory')) {
                console.warn('[NodeMidiService] Memory allocation failure detected. Increasing poll interval.');
                this.logDebug(`[NodeMidiService] Current memory usage: ${this.getMemoryUsage().toFixed(1)} MB`);
                this.logDebug(`[NodeMidiService] Error devices list: ${this.errorDevices.join(', ')}`);
            }
        } finally {
            // Calculate next poll interval with exponential backoff
            const backoffMultiplier = Math.min(Math.pow(2, this.consecutiveErrors), 8); // Cap at 8x
            const nextPollInterval = Math.min(this.basePollInterval * backoffMultiplier, this.maxPollInterval);

            this.logDebug(`[NodeMidiService] Next poll in ${nextPollInterval / 1000} seconds (errors: ${this.consecutiveErrors})`);
            this.logDebug('[NodeMidiService] === Poll cycle ended ===\n');
            setTimeout(this.pollForConnectedDevices, nextPollInterval);
        }
    };
}
