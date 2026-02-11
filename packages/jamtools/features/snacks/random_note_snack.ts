import springboard from 'springboard';

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        RandomNote: RandomNoteModuleReturnValue;
    }
}

type RandomNoteModuleReturnValue = {
    togglePlaying: () => void;
    workflowId: string;
}

springboard.registerModule('RandomNote', {}, async (moduleAPI): Promise<RandomNoteModuleReturnValue> => {
    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('enhanced_macro');

    // Create a dynamic workflow for random note generation
    const workflowId = await macroModule.createWorkflow({
        id: 'random_note_generator',
        name: 'Random Note Generator',
        description: 'Generates random MIDI notes with configurable timing and velocity',
        enabled: true,
        version: 1,
        created: Date.now(),
        modified: Date.now(),
        macros: [
            {
                id: 'trigger_input',
                type: 'musical_keyboard_input',
                config: { enableQwerty: false },
                position: { x: 0, y: 0 }
            },
            {
                id: 'random_generator',
                type: 'value_mapper',
                config: {
                    // Random note generation logic
                    mode: 'continuous',
                    interval: 50, // milliseconds
                    noteRange: { min: 24, max: 72 }, // C1 to C4
                    velocityRange: { min: 1, max: 127 },
                    noteDuration: 100
                },
                position: { x: 100, y: 0 }
            },
            {
                id: 'note_output',
                type: 'musical_keyboard_output',
                config: {},
                position: { x: 200, y: 0 }
            }
        ],
        connections: [
            {
                id: 'trigger_to_generator',
                sourceNodeId: 'trigger_input',
                sourcePortId: 'default',
                targetNodeId: 'random_generator',
                targetPortId: 'input'
            },
            {
                id: 'generator_to_output',
                sourceNodeId: 'random_generator',
                sourcePortId: 'output',
                targetNodeId: 'note_output',
                targetPortId: 'default'
            }
        ]
    });

    let playing = false;
    let currentInterval: NodeJS.Timeout | undefined;

    const playRandomNote = async () => {
        // In the dynamic system, random note generation would be handled
        // by the workflow's value_mapper macro with real-time updates
        
        const randomNumber = Math.random();
        const scaled = Math.round(randomNumber * 48);
        const inOctave = scaled + 24;
        const randomVelocity = Math.floor(Math.random() * 128);

        // Use workflow hot reloading to update note parameters dynamically
        const workflow = macroModule.getWorkflow(workflowId);
        if (workflow) {
            await macroModule.updateWorkflow(workflowId, {
                ...workflow,
                modified: Date.now(),
                // Update random parameters in real-time
                macros: workflow.macros.map(macro => 
                    macro.id === 'random_generator' 
                        ? { ...macro, config: { ...macro.config, currentNote: inOctave, currentVelocity: randomVelocity } }
                        : macro
                )
            });
        }

        console.log('Generated dynamic random note:', { note: inOctave, velocity: randomVelocity });
    };

    const startPlaying = () => {
        currentInterval = setInterval(() => {
            playRandomNote();
        }, 50);
    };

    const stopPlaying = () => {
        clearInterval(currentInterval);
    };

    const togglePlaying = async () => {
        if (playing) {
            stopPlaying();
            await macroModule.disableWorkflow(workflowId);
        } else {
            startPlaying();
            await macroModule.enableWorkflow(workflowId);
        }

        playing = !playing;
        console.log(`Random note generator ${playing ? 'started' : 'stopped'} using workflow:`, workflowId);
    };

    // Note: In full implementation, we'd use workflow event subscription
    // instead of the legacy subscription pattern
    console.log('Random Note Generator initialized with dynamic workflow:', workflowId);

    return {
        togglePlaying,
        workflowId
    };
});
