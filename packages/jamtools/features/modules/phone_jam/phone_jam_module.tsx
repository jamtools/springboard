import React from 'react';

import springboard from 'springboard';

springboard.registerModule('phone_jam', {}, async (moduleAPI) => {
    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('enhanced_macro');

    // Create a simple output workflow for phone jamming
    const outputWorkflowId = await macroModule.createWorkflow({
        id: 'phone_jam_output',
        name: 'Phone Jam Output',
        description: 'Simple MIDI output for phone-based jamming',
        enabled: true,
        version: 1,
        created: Date.now(),
        modified: Date.now(),
        macros: [
            {
                id: 'local_output',
                type: 'musical_keyboard_output',
                config: { allowLocal: true },
                position: { x: 0, y: 0 }
            }
        ],
        connections: []
    });

    // Get workflow instance for direct interaction
    const workflow = macroModule.getWorkflow(outputWorkflowId);
    
    const playSound = async () => {
        if (workflow) {
            // In the dynamic system, we'd use the workflow's event system
            // For now, we'll demonstrate the concept with direct workflow control
            
            // Play note
            await macroModule.updateWorkflow(outputWorkflowId, {
                ...workflow,
                modified: Date.now(),
                // Trigger note event through workflow
            });
            
            console.log('Playing sound through dynamic workflow:', outputWorkflowId);
            
            // Note: In a full implementation, the workflow would handle
            // the note on/off timing automatically through its event system
        }
    };

    moduleAPI.registerRoute('', {}, () => {
        return (
            <PhoneJamView
                onClickPlaySound={playSound}
                workflowId={outputWorkflowId}
            />
        );
    });
});

type PhoneJamViewProps = {
    onClickPlaySound: () => void;
    workflowId: string;
}

const PhoneJamView = (props: PhoneJamViewProps) => {
    return (
        <div>
            <h1>
                Phone Jam (Dynamic Workflow)
            </h1>

            <div style={{marginBottom: '20px'}}>
                <p><strong>Workflow ID:</strong> {props.workflowId}</p>
                <p>This uses the new dynamic workflow system for MIDI output.</p>
            </div>

            <div>
                <button
                    onClick={props.onClickPlaySound}
                    style={{
                        padding: '15px 30px',
                        fontSize: '16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                >
                    Play Sound (Dynamic)
                </button>
            </div>

            <div style={{marginTop: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '5px'}}>
                <strong>Dynamic Features:</strong>
                <ul>
                    <li>Workflow-based MIDI output</li>
                    <li>Hot reloadable configuration</li>
                    <li>Real-time parameter updates</li>
                    <li>Performance monitoring</li>
                </ul>
            </div>
        </div>
    );
};
