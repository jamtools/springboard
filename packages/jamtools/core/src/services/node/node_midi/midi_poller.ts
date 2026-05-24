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

    public initialize = async () => {
        const amidiSupported = await AMidiDevicePoller.isSupported();
        this.poller = amidiSupported ? new AMidiDevicePoller() : new EasyMidiDevicePoller();
    };

    public pollForDevices = async (knownDevices: string[]): Promise<MidiPollResponse> => {
        const polledDevices = (await this.poller.poll()).filter(d => !d.humanReadableName.startsWith('Midi Through') && !d.humanReadableName.includes('RtMidi'));
        const newlyConnectedDevices: DeviceMetadata[] = [];
        const newlyDisconnectedDevices: DeviceMetadata[] = [];

        const currentDeviceNames = polledDevices.map(device => device.humanReadableName);

        // Identify newly connected devices
        polledDevices.forEach(device => {
            if (!knownDevices.find(name => name.startsWith(device.humanReadableName))) {
                newlyConnectedDevices.push(device);
            }
        });

        // Identify disconnected devices
        knownDevices.forEach(knownDevice => {
            if (!currentDeviceNames.find(name => knownDevice.startsWith(name))) {
                newlyDisconnectedDevices.push({
                    humanReadableName: knownDevice,
                    machineReadableName: knownDevice,
                    input: true,
                    output: true,
                });
            }
        });

        if (newlyConnectedDevices.length) {
            let inputs: string[] | undefined;
            let outputs: string[] | undefined;
            for (const device of newlyConnectedDevices) {
                if (device.input) {
                    if (!inputs) {
                        inputs = easymidi.getInputs();
                    }

                    const foundInput = inputs.find(deviceName => deviceName.startsWith(device.humanReadableName));
                    if (foundInput) {
                        device.machineReadableName = foundInput;
                        continue;
                    }
                }
                if (device.output) {
                    if (!outputs) {
                        outputs = easymidi.getOutputs();
                    }

                    const foundOutput = outputs.find(deviceName => deviceName.startsWith(device.humanReadableName));
                    if (foundOutput) {
                        device.machineReadableName = foundOutput;
                        continue;
                    }
                }
            }
        }

        return {newlyConnectedDevices, newlyDisconnectedDevices};
    };
}

class EasyMidiDevicePoller implements NodeMidiDevicePoller {
    public async poll(): Promise<DeviceMetadata[]> {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
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
    static async isSupported(): Promise<boolean> {
        try {
            await execPromise('amidi -l');
            return true;
        } catch {
            return false;
        }
    }

    // private forceNoMidiDevices = false;

    public poll = async (): Promise<DeviceMetadata[]> => {
        // this.forceNoMidiDevices = !this.forceNoMidiDevices;
        // if (this.forceNoMidiDevices) {
        //     return [];
        // }

        try {
            const amidiOutput = await this.getAmidiDevices();
            const aseqOutput = await this.getAseqHumanReadableNames();

            for (const device of amidiOutput) {
                const humanReadableName = aseqOutput.get(device.machineReadableName);
                if (humanReadableName) {
                    device.humanReadableName = humanReadableName;
                }
            }

            return amidiOutput;
        } catch (err) {
            console.error('Failed to poll MIDI devices using amidi and aseqdump', err);
            return [];
        }
    };

    private getAmidiDevices = async (): Promise<DeviceMetadata[]> => {
        const {stdout} = await execPromise('amidi -l');
        const devices: DeviceMetadata[] = [];
        const lines = stdout.split('\n').filter(line => line.trim() !== '').slice(1);

        lines.forEach(line => {
            const [dir, _portName, ...clientNameParts] = line.split(' ').filter(Boolean);
            const name = clientNameParts.join(' ');

            if (!dir || devices.find(d => d.machineReadableName === name)) {
                return;
            }

            devices.push({
                humanReadableName: name,
                machineReadableName: name,
                input: dir.includes('I'),
                output: dir.includes('O'),
            });
        });

        return devices;
    };

    private getAseqHumanReadableNames = async (): Promise<Map<string, string>> => {
        const {stdout} = await execPromise('aseqdump -l');
        const humanReadableMap = new Map<string, string>();
        const lines = stdout.split('\n').filter(line => line.trim() !== '').slice(1);

        lines.forEach((line) => {
            if (line.trim() === '' || line.includes('Client name')) {
                return;
            }

            // TODO: this seems brittle
            const clientPart = line.slice(7, 37).trim();
            const portNamePart = line.slice(37).trim();

            humanReadableMap.set(portNamePart.trim(), clientPart.trim());
        });

        return humanReadableMap;
    };
}
