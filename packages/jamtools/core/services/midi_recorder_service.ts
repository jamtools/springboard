import {writeMidi, MidiData} from 'midi-file';
import {Buffer} from 'buffer';
import {Subject} from 'rxjs';

import {MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {MidiClockService, MidiClockInfo} from './midi_clock_service';

export type RecordedMidiEvent = {
    event: MidiEventFull;
    time: number;
    ticksSinceStart?: number; // MIDI ticks from start based on clock
};

export type MidiRecordingSession = {
    events: RecordedMidiEvent[];
    deviceName: string;
    startTime: number;
    endTime?: number;
    clockInfo?: MidiClockInfo;
    detectedBpm?: number;
};

export type RecorderOptions = {
    ticksPerBeat?: number;
    defaultBpm?: number;
    useClockForTiming?: boolean;
};

export class MidiRecorderService {
    private currentSessions: Map<string, MidiRecordingSession> = new Map();
    private clockService: MidiClockService;
    private recordingStartTime = 0;
    
    private options: Required<RecorderOptions> = {
        ticksPerBeat: 480,
        defaultBpm: 120,
        useClockForTiming: true,
    };

    public onSessionStarted = new Subject<{deviceName: string, session: MidiRecordingSession}>();
    public onSessionEnded = new Subject<{deviceName: string, session: MidiRecordingSession}>();

    constructor(clockService: MidiClockService, options?: RecorderOptions) {
        this.clockService = clockService;
        if (options) {
            this.options = {...this.options, ...options};
        }
    }

    public startRecording = (deviceName: string) => {
        const session: MidiRecordingSession = {
            events: [],
            deviceName,
            startTime: performance.now(),
            clockInfo: this.clockService.getCurrentClockInfo(),
        };

        this.currentSessions.set(deviceName, session);
        this.recordingStartTime = session.startTime;
        
        this.onSessionStarted.next({deviceName, session});
    };

    public stopRecording = (deviceName: string): MidiRecordingSession | null => {
        const session = this.currentSessions.get(deviceName);
        if (!session) {
            return null;
        }

        session.endTime = performance.now();
        session.clockInfo = this.clockService.getCurrentClockInfo();
        session.detectedBpm = session.clockInfo.isActive ? session.clockInfo.bpm : this.options.defaultBpm;
        
        this.currentSessions.delete(deviceName);
        
        this.onSessionEnded.next({deviceName, session});
        return session;
    };

    public recordEvent = (midiEventFull: MidiEventFull): void => {
        const deviceName = midiEventFull.deviceInfo.name;
        const session = this.currentSessions.get(deviceName);
        
        if (!session) {
            // Auto-start recording for this device
            this.startRecording(deviceName);
            return this.recordEvent(midiEventFull);
        }

        const currentTime = performance.now();
        let ticksSinceStart: number | undefined;

        if (this.options.useClockForTiming && this.clockService.getCurrentClockInfo().isActive) {
            // Use MIDI clock for precise timing
            const clockInfo = this.clockService.getCurrentClockInfo();
            const timeSinceRecordingStart = currentTime - this.recordingStartTime;
            
            // Calculate ticks based on actual BPM from clock
            const beatsPerMs = clockInfo.bpm / 60000;
            const ticksPerMs = beatsPerMs * this.options.ticksPerBeat;
            ticksSinceStart = Math.round(timeSinceRecordingStart * ticksPerMs);
        } else {
            // Fallback to default BPM calculation
            const timeSinceRecordingStart = currentTime - this.recordingStartTime;
            const beatsPerMs = this.options.defaultBpm / 60000;
            const ticksPerMs = beatsPerMs * this.options.ticksPerBeat;
            ticksSinceStart = Math.round(timeSinceRecordingStart * ticksPerMs);
        }

        const recordedEvent: RecordedMidiEvent = {
            event: midiEventFull,
            time: currentTime,
            ticksSinceStart,
        };

        session.events.push(recordedEvent);
    };

    public getActiveRecordings = (): string[] => {
        return Array.from(this.currentSessions.keys());
    };

    public isRecording = (deviceName: string): boolean => {
        return this.currentSessions.has(deviceName);
    };

    public stopAllRecordings = (): MidiRecordingSession[] => {
        const sessions: MidiRecordingSession[] = [];
        for (const deviceName of this.currentSessions.keys()) {
            const session = this.stopRecording(deviceName);
            if (session) {
                sessions.push(session);
            }
        }
        return sessions;
    };

    public sessionToMidiFile = (session: MidiRecordingSession): Buffer => {
        const bpm = session.detectedBpm || this.options.defaultBpm;
        
        // Create tempo track
        const tempoTrack = [{
            deltaTime: 0,
            type: 'setTempo' as const,
            microsecondsPerBeat: Math.round(60000000 / bpm), // Convert BPM to microseconds per beat
        }];

        // Convert events to MIDI format
        const eventTrack = [];
        let previousTicks = 0;

        for (const recordedEvent of session.events) {
            const {event} = recordedEvent.event;
            
            // Skip clock events in the output file
            if (event.type === 'clock') {
                continue;
            }

            const currentTicks = recordedEvent.ticksSinceStart || 0;
            const deltaTime = currentTicks - previousTicks;
            previousTicks = currentTicks;

            const midiTrackEvent = this.convertMidiEventToMidiFileFormat(event, deltaTime);
            if (midiTrackEvent) {
                eventTrack.push(midiTrackEvent);
            }
        }

        // Create MIDI file structure
        const midiData: MidiData = {
            header: {
                format: 1, // Multi-track format
                numTracks: 2, // Tempo track + event track
                ticksPerBeat: this.options.ticksPerBeat,
            },
            tracks: [tempoTrack, eventTrack],
        };

        return Buffer.from(writeMidi(midiData));
    };

    private convertMidiEventToMidiFileFormat = (event: MidiEventFull['event'], deltaTime: number): MidiData['tracks'][0][0] | null => {
        if (event.type === 'noteon') {
            return {
                deltaTime,
                type: 'noteOn',
                noteNumber: event.number,
                velocity: event.velocity || 64,
                channel: event.channel,
            };
        }
        if (event.type === 'noteoff') {
            return {
                deltaTime,
                type: 'noteOff',
                noteNumber: event.number,
                velocity: 0,
                channel: event.channel,
            };
        }
        if (event.type === 'cc') {
            return {
                deltaTime,
                type: 'controller',
                controllerType: event.number,
                value: event.value!,
                channel: event.channel,
            };
        }

        return null;
    };
}