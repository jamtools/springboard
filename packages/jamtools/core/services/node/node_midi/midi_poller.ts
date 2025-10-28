import {exec} from 'child_process';
import util from 'util';

import easymidi from 'easymidi';

const execPromise = util.promisify(exec);

type DeviceMetadata = {
    humanReadableName: string;
    machineReadableName: string;
    input: boolean;
    output: boolean;
}

type MidiPollResponse = {
    newlyConnectedDevices: DeviceMetadata[];
    newlyDisconnectedDevices: DeviceMetadata[];
};

interface NodeMidiDevicePoller {
    poll(): Promise<DeviceMetadata[]>;
}

export class NodeMidiDevicePollerService {
    private poller!: NodeMidiDevicePoller;
    private isUsingAmidi = false;
    private debugLoggingEnabled = process.env.ENABLE_MIDI_POLLER_DEBUG_LOGGING === 'true';

    private logDebug = (message: string, ...args: any[]) => {
        if (this.debugLoggingEnabled) {
            console.log(message, ...args);
        }
    };

    public initialize = async () => {
        this.logDebug('[MidiPoller] Initializing NodeMidiDevicePollerService...');
        const amidiSupported = await AMidiDevicePoller.isSupported();
        this.isUsingAmidi = amidiSupported;
        this.logDebug(`[MidiPoller] AMidi supported: ${amidiSupported}, using ${amidiSupported ? 'AMidiDevicePoller' : 'EasyMidiDevicePoller'}`);
        this.poller = amidiSupported ? new AMidiDevicePoller() : new EasyMidiDevicePoller();
    };

    public pollForDevices = async (knownDevices: string[]): Promise<MidiPollResponse> => {
        console.log('[DEBUG] === POLLING FOR DEVICES START ===');
        this.logDebug(`[MidiPoller] Starting poll. Known devices: ${knownDevices.length}`);
        this.logDebug(`[MidiPoller] Known device names: ${JSON.stringify(knownDevices)}`);

        console.log(`[DEBUG] Using ${this.isUsingAmidi ? 'AMidiDevicePoller' : 'EasyMidiDevicePoller'}`);

        const startTime = Date.now();
        const allPolledDevices = await this.poller.poll();
        const pollTime = Date.now() - startTime;
        console.log(`[DEBUG] Raw poll results (${allPolledDevices.length} devices):`, JSON.stringify(allPolledDevices, null, 2));
        this.logDebug(`[MidiPoller] Poll completed in ${pollTime}ms. Found ${allPolledDevices.length} total devices`);

        const polledDevices = allPolledDevices.filter(d => !d.humanReadableName.startsWith('Midi Through') && !d.humanReadableName.includes('RtMidi'));
        console.log(`[DEBUG] After filtering out system devices (${polledDevices.length} devices):`, JSON.stringify(polledDevices, null, 2));
        this.logDebug(`[MidiPoller] After filtering: ${polledDevices.length} devices`);
        
        const newlyConnectedDevices: DeviceMetadata[] = [];
        const newlyDisconnectedDevices: DeviceMetadata[] = [];

        const currentDeviceNames = polledDevices.map(device => device.humanReadableName);
        console.log(`[DEBUG] Current device names from poll: ${JSON.stringify(currentDeviceNames)}`);

        console.log('[DEBUG] === IDENTIFYING NEWLY CONNECTED DEVICES ===');
        // Identify newly connected devices
        polledDevices.forEach(device => {
            const isKnown = knownDevices.find(name => name.startsWith(device.humanReadableName));
            console.log(`[DEBUG] Checking device "${device.humanReadableName}": known=${!!isKnown}, knownName="${isKnown || 'none'}"`);

            if (!isKnown) {
                console.log(`[DEBUG] NEWLY CONNECTED: ${device.humanReadableName} (machine: ${device.machineReadableName})`);
                newlyConnectedDevices.push(device);
            }
        });

        console.log('[DEBUG] === IDENTIFYING DISCONNECTED DEVICES ===');
        // Identify disconnected devices
        knownDevices.forEach(knownDevice => {
            const stillConnected = currentDeviceNames.find(name => knownDevice.startsWith(name));
            console.log(`[DEBUG] Checking known device "${knownDevice}": stillConnected=${!!stillConnected}, currentName="${stillConnected || 'none'}"`);

            if (!stillConnected) {
                console.log(`[DEBUG] DISCONNECTED: ${knownDevice}`);
                newlyDisconnectedDevices.push({
                    humanReadableName: knownDevice,
                    machineReadableName: knownDevice,
                    input: true,
                    output: true,
                });
            }
        });

        if (newlyConnectedDevices.length && !this.isUsingAmidi) {
            console.log('[DEBUG] === PROCESSING DEVICE NAMES WITH EASYMIDI ===');
            this.logDebug('[MidiPoller] Processing newly connected devices with EasyMidi for machine-readable names...');
            // Only use easymidi for machine-readable names if not using AMidi
            let inputs: string[] | undefined;
            let outputs: string[] | undefined;
            for (const device of newlyConnectedDevices) {
                console.log(`[DEBUG] Processing device: "${device.humanReadableName}" (input: ${device.input}, output: ${device.output})`);
                console.log(`[DEBUG] Original machine name: "${device.machineReadableName}"`);
                this.logDebug(`[MidiPoller] Processing device: ${device.humanReadableName} (input: ${device.input}, output: ${device.output})`);

                if (device.input) {
                    if (!inputs) {
                        console.log('[DEBUG] Getting EasyMidi inputs list...');
                        this.logDebug('[MidiPoller] Getting EasyMidi inputs...');
                        const startTime = Date.now();
                        inputs = easymidi.getInputs();
                        this.logDebug(`[MidiPoller] EasyMidi.getInputs() took ${Date.now() - startTime}ms`);
                        console.log(`[DEBUG] EasyMidi inputs: ${JSON.stringify(inputs)}`);
                        this.logDebug(`[MidiPoller] EasyMidi inputs: ${JSON.stringify(inputs)}`);
                    }

                    const foundInput = inputs.find(deviceName => deviceName.startsWith(device.humanReadableName));
                    console.log(`[DEBUG] Looking for input matching "${device.humanReadableName}": found="${foundInput || 'none'}"`);
                    if (foundInput) {
                        console.log(`[DEBUG] Updating machine name from "${device.machineReadableName}" to "${foundInput}"`);
                        this.logDebug(`[MidiPoller] Found machine-readable name for input: ${foundInput}`);
                        device.machineReadableName = foundInput;
                        continue;
                    }
                }
                if (device.output) {
                    if (!outputs) {
                        console.log('[DEBUG] Getting EasyMidi outputs list...');
                        this.logDebug('[MidiPoller] Getting EasyMidi outputs...');
                        const startTime = Date.now();
                        outputs = easymidi.getOutputs();
                        this.logDebug(`[MidiPoller] EasyMidi.getOutputs() took ${Date.now() - startTime}ms`);
                        console.log(`[DEBUG] EasyMidi outputs: ${JSON.stringify(outputs)}`);
                        this.logDebug(`[MidiPoller] EasyMidi outputs: ${JSON.stringify(outputs)}`);
                    }

                    const foundOutput = outputs.find(deviceName => deviceName.startsWith(device.humanReadableName));
                    console.log(`[DEBUG] Looking for output matching "${device.humanReadableName}": found="${foundOutput || 'none'}"`);
                    if (foundOutput) {
                        console.log(`[DEBUG] Updating machine name from "${device.machineReadableName}" to "${foundOutput}"`);
                        this.logDebug(`[MidiPoller] Found machine-readable name for output: ${foundOutput}`);
                        device.machineReadableName = foundOutput;
                        continue;
                    }
                }
                console.log(`[DEBUG] No EasyMidi name match found for "${device.humanReadableName}", keeping "${device.machineReadableName}"`);
            }
        }

        console.log('[DEBUG] === POLLING RESULTS SUMMARY ===');
        console.log(`[DEBUG] Newly connected: ${newlyConnectedDevices.length}, Newly disconnected: ${newlyDisconnectedDevices.length}`);

        this.logDebug(`[MidiPoller] Poll complete. Newly connected: ${newlyConnectedDevices.length}, Newly disconnected: ${newlyDisconnectedDevices.length}`);
        if (newlyConnectedDevices.length > 0) {
            console.log('[DEBUG] Final newly connected devices:', JSON.stringify(newlyConnectedDevices, null, 2));
            this.logDebug('[MidiPoller] Newly connected devices:', JSON.stringify(newlyConnectedDevices, null, 2));
        }
        if (newlyDisconnectedDevices.length > 0) {
            console.log('[DEBUG] Final newly disconnected devices:', JSON.stringify(newlyDisconnectedDevices, null, 2));
            this.logDebug('[MidiPoller] Newly disconnected devices:', JSON.stringify(newlyDisconnectedDevices, null, 2));
        }

        console.log('[DEBUG] === POLLING FOR DEVICES END ===\n');
        return {newlyConnectedDevices, newlyDisconnectedDevices};
    };
}

class EasyMidiDevicePoller implements NodeMidiDevicePoller {
    public async poll(): Promise<DeviceMetadata[]> {
        console.log('[EasyMidiPoller] Starting poll...');
        const inputStartTime = Date.now();
        const inputs = easymidi.getInputs();
        const inputTime = Date.now() - inputStartTime;
        console.log(`[EasyMidiPoller] getInputs() took ${inputTime}ms, found ${inputs.length} inputs`);
        
        const outputStartTime = Date.now();
        const outputs = easymidi.getOutputs();
        const outputTime = Date.now() - outputStartTime;
        console.log(`[EasyMidiPoller] getOutputs() took ${outputTime}ms, found ${outputs.length} outputs`);
        
        const devices: DeviceMetadata[] = [];

        const allDeviceNames = Array.from(new Set(inputs.concat(outputs)));

        for (const deviceName of allDeviceNames) {
            const supportsInput = inputs.includes(deviceName);
            const supportsOutput = outputs.includes(deviceName);

            devices.push({
                humanReadableName: deviceName,
                machineReadableName: deviceName,
                input: supportsInput,
                output: supportsOutput,
            });
        }

        return devices;
    }
}

class AMidiDevicePoller implements NodeMidiDevicePoller {
    private debugLoggingEnabled = process.env.ENABLE_MIDI_POLLER_DEBUG_LOGGING === 'true';

    private logDebug = (message: string, ...args: any[]) => {
        if (this.debugLoggingEnabled) {
            console.log(message, ...args);
        }
    };

    static async isSupported(): Promise<boolean> {
        const debugLoggingEnabled = process.env.ENABLE_MIDI_POLLER_DEBUG_LOGGING === 'true';
        try {
            if (debugLoggingEnabled) {
                console.log('[AMidiPoller] Checking if amidi is available...');
            }
            await execPromise('amidi -l');
            if (debugLoggingEnabled) {
                console.log('[AMidiPoller] amidi is supported on this system');
            }
            return true;
        } catch (error) {
            if (debugLoggingEnabled) {
                console.log('[AMidiPoller] amidi is not available:', error instanceof Error ? error.message : 'Unknown error');
            }
            return false;
        }
    }

    // private forceNoMidiDevices = false;

    public poll = async (): Promise<DeviceMetadata[]> => {
        // this.forceNoMidiDevices = !this.forceNoMidiDevices;
        // if (this.forceNoMidiDevices) {
        //     return [];
        // }
        this.logDebug('[AMidiPoller] Starting poll...');

        try {
            const amidiStartTime = Date.now();
            const amidiOutput = await this.getAmidiDevices();
            this.logDebug(`[AMidiPoller] getAmidiDevices() took ${Date.now() - amidiStartTime}ms`);
            
            const aseqStartTime = Date.now();
            const aseqOutput = await this.getAseqHumanReadableNames();
            this.logDebug(`[AMidiPoller] getAseqHumanReadableNames() took ${Date.now() - aseqStartTime}ms`);

            for (const device of amidiOutput) {
                // Try to find mapping using the client name part (after the hw: prefix)
                const deviceClientName = device.humanReadableName; // e.g., "Digital Piano MIDI 1"
                const betterHumanName = aseqOutput.get(deviceClientName);
                if (betterHumanName) {
                    console.log(`[DEBUG] Mapped "${deviceClientName}" -> "${betterHumanName}"`);
                    device.humanReadableName = betterHumanName;
                } else {
                    console.log(`[DEBUG] No aseq mapping found for "${deviceClientName}", keeping original`);
                }
            }

            this.logDebug(`[AMidiPoller] Poll complete. Found ${amidiOutput.length} devices`);
            return amidiOutput;
        } catch (err) {
            console.error('[AMidiPoller] Failed to poll MIDI devices using amidi and aseqdump', err);
            return [];
        }
    };

    private getAmidiDevices = async (): Promise<DeviceMetadata[]> => {
        this.logDebug('[AMidiPoller] Executing: amidi -l');
        const {stdout} = await execPromise('amidi -l');
        this.logDebug('[AMidiPoller] Raw amidi output:', stdout);
        const devices: DeviceMetadata[] = [];
        const lines = stdout.split('\n').filter(line => line.trim() !== '').slice(1);
        this.logDebug(`[AMidiPoller] Processing ${lines.length} device lines...`);

        lines.forEach(line => {
            const [dir, portName, ...clientNameParts] = line.split(' ').filter(Boolean);
            const clientName = clientNameParts.join(' ');
            
            // Use the full name (e.g., "hw:1,0,0 USB Midi Cable") as machine-readable
            // This matches what easymidi would return
            const fullName = `${portName} ${clientName}`;

            if (devices.find(d => d.machineReadableName === fullName)) {
                return;
            }

            const device = {
                humanReadableName: clientName,
                machineReadableName: fullName,
                input: dir.includes('I'),
                output: dir.includes('O'),
            };
            this.logDebug(`[AMidiPoller] Adding device: ${JSON.stringify(device)}`);
            devices.push(device);
        });

        return devices;
    };

    private getAseqHumanReadableNames = async (): Promise<Map<string, string>> => {
        this.logDebug('[AMidiPoller] Executing: aseqdump -l');
        const {stdout} = await execPromise('aseqdump -l');
        this.logDebug('[AMidiPoller] Raw aseqdump output:', stdout);
        const humanReadableMap = new Map<string, string>();
        const lines = stdout.split('\n').filter(line => line.trim() !== '').slice(1);
        this.logDebug(`[AMidiPoller] Processing ${lines.length} aseqdump lines...`);

        lines.forEach((line) => {
            if (line.trim() === '' || line.includes('Client name')) {
                return;
            }

            // TODO: this seems brittle
            const clientPart = line.slice(7, 37).trim();
            const portNamePart = line.slice(37).trim();

            humanReadableMap.set(portNamePart.trim(), clientPart.trim());
            this.logDebug(`[AMidiPoller] Mapped: '${portNamePart.trim()}' -> '${clientPart.trim()}'`);
        });

        return humanReadableMap;
    };
}
