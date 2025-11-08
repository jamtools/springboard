import {Subject} from 'rxjs';
import {MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {MidiRecorderService, MidiRecordingSession, RecorderOptions} from './midi_recorder_service';
import {MidiClockService} from './midi_clock_service';

export type MidiRecorderHelperOptions = RecorderOptions & {
    inactivityTimeLimitSeconds?: number;
    onRecordingStarted?: (deviceName: string) => void;
    onRecordingStopped?: (deviceName: string, session: MidiRecordingSession) => void;
};

/**
 * Helper class that simplifies MIDI recording with clock support.
 * This is designed to replace or enhance the MidiRecorderImpl pattern.
 */
export class MidiRecorderHelper {
    private recorderService: MidiRecorderService;
    private deviceTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private options: Required<MidiRecorderHelperOptions>;

    constructor(clockService: MidiClockService, options: MidiRecorderHelperOptions = {}) {
        this.options = {
            ticksPerBeat: 480,
            defaultBpm: 120,
            useClockForTiming: true,
            inactivityTimeLimitSeconds: 60,
            onRecordingStarted: () => {},
            onRecordingStopped: () => {},
            ...options,
        };

        this.recorderService = new MidiRecorderService(clockService, {
            ticksPerBeat: this.options.ticksPerBeat,
            defaultBpm: this.options.defaultBpm,
            useClockForTiming: this.options.useClockForTiming,
        });

        // Set up session event handlers
        this.recorderService.onSessionStarted.subscribe(({deviceName, session}) => {
            this.options.onRecordingStarted(deviceName);
            this.resetDeviceInactivityTimer(deviceName);
        });

        this.recorderService.onSessionEnded.subscribe(({deviceName, session}) => {
            this.options.onRecordingStopped(deviceName, session);
            this.clearDeviceInactivityTimer(deviceName);
        });
    }

    /**
     * Subscribe this helper to a MIDI input stream to automatically record events
     */
    public subscribeToMidiInput = (midiInputSubject: Subject<MidiEventFull>) => {
        midiInputSubject.subscribe(this.handleMidiEvent);
    };

    private handleMidiEvent = (midiEventFull: MidiEventFull) => {
        const deviceName = midiEventFull.deviceInfo.name;
        
        // Skip clock events for inactivity timer (they're too frequent)
        if (midiEventFull.event.type !== 'clock') {
            this.resetDeviceInactivityTimer(deviceName);
        }

        this.recorderService.recordEvent(midiEventFull);
    };

    private resetDeviceInactivityTimer = (deviceName: string) => {
        this.clearDeviceInactivityTimer(deviceName);

        const timeout = setTimeout(() => {
            if (this.recorderService.isRecording(deviceName)) {
                this.recorderService.stopRecording(deviceName);
            }
        }, this.options.inactivityTimeLimitSeconds * 1000);

        this.deviceTimeouts.set(deviceName, timeout);
    };

    private clearDeviceInactivityTimer = (deviceName: string) => {
        const timeout = this.deviceTimeouts.get(deviceName);
        if (timeout) {
            clearTimeout(timeout);
            this.deviceTimeouts.delete(deviceName);
        }
    };

    /**
     * Manually start recording for a device
     */
    public startRecording = (deviceName: string) => {
        return this.recorderService.startRecording(deviceName);
    };

    /**
     * Manually stop recording for a device and get the session
     */
    public stopRecording = (deviceName: string): MidiRecordingSession | null => {
        return this.recorderService.stopRecording(deviceName);
    };

    /**
     * Convert a recording session to a MIDI file buffer
     */
    public sessionToMidiFile = (session: MidiRecordingSession): Buffer => {
        return this.recorderService.sessionToMidiFile(session);
    };

    /**
     * Get list of currently recording devices
     */
    public getActiveRecordings = (): string[] => {
        return this.recorderService.getActiveRecordings();
    };

    /**
     * Check if a device is currently recording
     */
    public isRecording = (deviceName: string): boolean => {
        return this.recorderService.isRecording(deviceName);
    };

    /**
     * Stop all active recordings and return their sessions
     */
    public stopAllRecordings = (): MidiRecordingSession[] => {
        const sessions = this.recorderService.stopAllRecordings();
        
        // Clear all inactivity timers
        for (const timeout of this.deviceTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.deviceTimeouts.clear();
        
        return sessions;
    };
}