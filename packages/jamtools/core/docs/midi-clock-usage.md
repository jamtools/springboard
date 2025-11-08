# MIDI Clock Recording Support

This guide shows how to use the new MIDI clock support in jamtools to record MIDI files with accurate tempo information.

## Overview

The MIDI clock system provides:

- **Automatic tempo detection** from MIDI clock messages (0xF8)
- **Precise timing** using 96 pulses per quarter note standard
- **Tempo tracks** in recorded MIDI files for proper playback
- **Clock-aware recording** that adapts to tempo changes

## Basic Usage

### Using MidiRecorderHelper (Recommended)

The `MidiRecorderHelper` class provides the easiest way to add clock-aware recording:

```tsx
import springboard from 'springboard';
import { MidiRecorderHelper } from '@jamtools/core';

springboard.registerModule('MyRecordingApp', {}, async (moduleAPI) => {
    const ioModule = moduleAPI.getModule('io');
    await ioModule.ensureListening();
    
    // Get the clock service from the IO module
    const clockService = ioModule.getMidiClockService();
    
    // Create recorder with clock support
    const recorder = new MidiRecorderHelper(clockService, {
        inactivityTimeLimitSeconds: 60,
        useClockForTiming: true,
        ticksPerBeat: 480,
        defaultBpm: 120,
        onRecordingStarted: (deviceName) => {
            console.log(`Started recording ${deviceName}`);
        },
        onRecordingStopped: (deviceName, session) => {
            console.log(`Stopped recording ${deviceName}`);
            console.log(`Detected BPM: ${session.detectedBpm}`);
            
            // Convert to MIDI file
            const midiBuffer = recorder.sessionToMidiFile(session);
            
            // Save or upload the file
            saveToFile(`${deviceName}_recording.mid`, midiBuffer);
        },
    });
    
    // Subscribe to MIDI input stream
    recorder.subscribeToMidiInput(ioModule.midiInputSubject);
});
```

### Advanced Usage with MidiRecorderService

For more control, use the `MidiRecorderService` directly:

```tsx
import { MidiRecorderService } from '@jamtools/core';

const clockService = ioModule.getMidiClockService();
const recorder = new MidiRecorderService(clockService, {
    ticksPerBeat: 480,
    defaultBpm: 120,
    useClockForTiming: true,
});

// Listen to recording events
recorder.onSessionStarted.subscribe(({deviceName, session}) => {
    console.log(`Started recording ${deviceName}`);
});

recorder.onSessionEnded.subscribe(({deviceName, session}) => {
    console.log(`Stopped recording ${deviceName}`, session);
    
    // Generate MIDI file with proper tempo
    const midiBuffer = recorder.sessionToMidiFile(session);
    saveToFile(`${deviceName}.mid`, midiBuffer);
});

// Record MIDI events manually
ioModule.midiInputSubject.subscribe((midiEvent) => {
    recorder.recordEvent(midiEvent);
});

// Start/stop recording for specific devices
recorder.startRecording('My MIDI Device');
// ... later
const session = recorder.stopRecording('My MIDI Device');
```

### Clock Information Access

Monitor MIDI clock status in real-time:

```tsx
const clockService = ioModule.getMidiClockService();

// Listen to clock events
clockService.onClockEvent.subscribe((clockEvent) => {
    if (clockEvent.type === 'tick') {
        const info = clockService.getCurrentClockInfo();
        console.log(`BPM: ${info.bpm}, Active: ${info.isActive}`);
    }
});

// Get current clock status
const clockInfo = clockService.getCurrentClockInfo();
console.log('Current BPM:', clockInfo.bpm);
console.log('Clock active:', clockInfo.isActive);
console.log('Tick count:', clockInfo.tickCount);
```

## Migration from MidiRecorderImpl

If you're using a custom `MidiRecorderImpl` class, here's how to migrate:

### Before (Custom Implementation)

```tsx
const recorder = new MidiRecorderImpl(
    ioModule.midiInputSubject,
    {log: console.log},
    fileSaver,
    recordingConfig
);
recorder.initialize();
```

### After (Using MidiRecorderHelper)

```tsx
const clockService = ioModule.getMidiClockService();
const recorder = new MidiRecorderHelper(clockService, {
    inactivityTimeLimitSeconds: recordingConfig.getState().inactivityTimeLimitSeconds,
    onRecordingStarted: (deviceName) => console.log(`Started recording ${deviceName}`),
    onRecordingStopped: (deviceName, session) => {
        const filename = `${deviceName}_${new Date().toISOString()}_recording.mid`;
        const midiBuffer = recorder.sessionToMidiFile(session);
        fileSaver.writeFile(filename, midiBuffer);
        console.log(`MIDI saved: ${filename} (BPM: ${session.detectedBpm})`);
    },
});

recorder.subscribeToMidiInput(ioModule.midiInputSubject);
```

## MIDI File Format

The generated MIDI files include:

1. **Tempo Track (Track 0)**: Contains tempo information from detected BPM
2. **Event Track (Track 1)**: Contains the actual MIDI events with precise timing
3. **Proper Delta Times**: Based on MIDI clock when available, fallback to default BPM
4. **Standard Format**: Compatible with all DAWs and MIDI players

## Clock Message Support

The system handles these MIDI real-time messages:

- **0xF8 (Clock)**: 24 ticks per quarter note, used for BPM calculation
- **0xFA (Start)**: Indicates sequence start
- **0xFC (Stop)**: Indicates sequence stop  
- **0xFB (Continue)**: Indicates sequence resume

## Benefits

1. **Accurate Tempo**: Recordings capture the actual tempo from the master clock
2. **Sync Compatibility**: Files play back at correct tempo in DAWs
3. **Dynamic Tempo**: Handles tempo changes during recording
4. **Better Timing**: More precise than performance.now()-based timing
5. **Standard Compliance**: Follows MIDI 1.0 specification for clock messages

## Notes

- MIDI clock support works in both browser and Node.js environments
- If no clock is detected, falls back to the specified default BPM
- Clock events themselves are not recorded to the output file (they're just used for timing)
- The system smooths BPM calculations to avoid rapid tempo fluctuations