import springboard from 'springboard';

springboard.registerModule('midi_thru_cc', {}, async (moduleAPI) => {
    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('enhanced_macro');

    // Use a simple template first, then create a custom processor workflow  
    const basicWorkflowId = await macroModule.createWorkflowFromTemplate('midi_cc_chain', {
        inputDevice: 'main_controller',    // User-configurable logical device
        inputChannel: 'lead',              // User-configurable logical channel  
        inputCC: 'filter_cutoff',          // User-configurable logical CC
        outputDevice: 'main_synth',        // User-configurable logical device
        outputChannel: 'lead',             // User-configurable logical channel
        outputCC: 'resonance',             // User-configurable logical CC
        minValue: 0,
        maxValue: 127
    });

    // Create a custom workflow for CC to Note conversion with logical references
    const customWorkflowId = await macroModule.createWorkflow({
        id: 'cc_to_note_converter',
        name: 'CC to Note Converter',
        description: 'Converts MIDI CC values to note events with custom logic',
        enabled: true,
        version: 1,
        created: Date.now(),
        modified: Date.now(),
        macros: [
            {
                id: 'cc_input',
                type: 'midi_control_change_input',
                config: {
                    // NOTE: Custom workflows could also resolve logical names
                    // In practice, we'd want deviceConfigManager integration here too
                },
                position: { x: 0, y: 0 }
            },
            {
                id: 'note_output',
                type: 'musical_keyboard_output',
                config: {
                    // NOTE: Similarly, this would resolve logical output device
                },
                position: { x: 200, y: 0 }
            },
            {
                id: 'cc_processor',
                type: 'value_mapper',
                config: {
                    // Custom processing logic for CC to note conversion
                    transform: (value: number) => {
                        // Skip odd values
                        if (value % 2 === 1) return null;
                        
                        // Convert CC value to note number
                        const noteNumber = value / 2;
                        
                        // Return note events with timing
                        return [
                            { type: 'noteon', number: noteNumber, velocity: 100 },
                            { type: 'noteoff', number: noteNumber, velocity: 0, delay: 50 }
                        ];
                    }
                },
                position: { x: 100, y: 0 }
            }
        ],
        connections: [
            {
                id: 'cc_to_processor',
                sourceNodeId: 'cc_input',
                sourcePortId: 'default',
                targetNodeId: 'cc_processor', 
                targetPortId: 'input'
            },
            {
                id: 'processor_to_output',
                sourceNodeId: 'cc_processor',
                sourcePortId: 'output',
                targetNodeId: 'note_output',
                targetPortId: 'default'
            }
        ]
    });

    console.log('Created basic CC chain workflow:', basicWorkflowId);
    console.log('Created custom CC-to-Note workflow:', customWorkflowId);
});
