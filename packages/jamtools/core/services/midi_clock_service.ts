import {Subject} from 'rxjs';

export type MidiClockInfo = {
    bpm: number;
    tickCount: number;
    isActive: boolean;
    lastTickTime: number;
};

export type MidiClockEvent = {
    type: 'tick' | 'start' | 'stop' | 'continue';
    timestamp: number;
};

export class MidiClockService {
    private clockSubject = new Subject<MidiClockEvent>();
    private tickTimes: number[] = [];
    private currentBpm = 120; // Default BPM
    private tickCount = 0;
    private isClockActive = false;
    private lastTickTime = 0;
    
    // MIDI clock sends 96 ticks per quarter note
    private static readonly TICKS_PER_QUARTER = 96;
    private static readonly SAMPLE_SIZE = 24; // Use last 24 ticks (1/4 beat) for BPM calculation

    public onClockEvent = this.clockSubject.asObservable();

    public processClockMessage = (timestamp: number) => {
        this.lastTickTime = timestamp;
        this.tickCount++;
        this.isClockActive = true;

        // Store tick time for BPM calculation
        this.tickTimes.push(timestamp);
        
        // Only keep the most recent sample for calculation
        if (this.tickTimes.length > MidiClockService.SAMPLE_SIZE) {
            this.tickTimes.shift();
        }

        // Calculate BPM if we have enough samples
        if (this.tickTimes.length >= 2) {
            this.calculateBpm();
        }

        this.clockSubject.next({
            type: 'tick',
            timestamp
        });
    };

    public processStartMessage = (timestamp: number) => {
        this.isClockActive = true;
        this.tickCount = 0;
        this.tickTimes = [];
        
        this.clockSubject.next({
            type: 'start',
            timestamp
        });
    };

    public processStopMessage = (timestamp: number) => {
        this.isClockActive = false;
        
        this.clockSubject.next({
            type: 'stop',
            timestamp
        });
    };

    public processContinueMessage = (timestamp: number) => {
        this.isClockActive = true;
        
        this.clockSubject.next({
            type: 'continue',
            timestamp
        });
    };

    private calculateBpm = () => {
        if (this.tickTimes.length < 2) {
            return;
        }

        // Calculate average time between ticks
        const timeSpan = this.tickTimes[this.tickTimes.length - 1] - this.tickTimes[0];
        const tickCount = this.tickTimes.length - 1;
        const avgTickInterval = timeSpan / tickCount;

        // Convert to BPM: 
        // 96 ticks per quarter note
        // 4 quarter notes per whole note (beat)
        // 60,000 ms per minute
        const beatsPerMs = 1 / (avgTickInterval * MidiClockService.TICKS_PER_QUARTER);
        const bpm = beatsPerMs * 60000;

        // Apply smoothing to avoid rapid BPM changes
        this.currentBpm = Math.round(this.currentBpm * 0.8 + bpm * 0.2);
    };

    public getCurrentClockInfo = (): MidiClockInfo => {
        return {
            bpm: this.currentBpm,
            tickCount: this.tickCount,
            isActive: this.isClockActive,
            lastTickTime: this.lastTickTime
        };
    };

    public reset = () => {
        this.tickTimes = [];
        this.tickCount = 0;
        this.isClockActive = false;
        this.lastTickTime = 0;
        this.currentBpm = 120;
    };
}