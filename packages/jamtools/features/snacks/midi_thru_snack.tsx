import React from 'react';
import springboard from 'springboard';

import '@jamtools/core/modules/macro_module/macro_module';

springboard.registerModule('midi_thru', {}, async (moduleAPI) => {
    const macroModule = moduleAPI.getModule('enhanced_macro');

    // Use logical device names that users can configure
    const workflowId = await macroModule.createWorkflowFromTemplate('midi_thru', {
        inputDevice: 'main_controller',  // User-configurable logical device
        outputDevice: 'main_synth'       // User-configurable logical device
    });

    moduleAPI.registerRoute('', {}, () => {
        return (
            <div>
                <h2>MIDI Thru (Dynamic Workflow)</h2>
                <p>Workflow ID: {workflowId}</p>
                <p>This workflow connects your main controller to your main synthesizer.</p>
                
                <div style={{padding: '15px', background: '#e8f5e8', borderRadius: '8px', margin: '10px 0'}}>
                    <strong>🎯 User-Configurable Setup:</strong>
                    <p>This workflow uses <strong>logical device names</strong> instead of hardcoded hardware:</p>
                    <ul>
                        <li><code>main_controller</code> → Maps to your configured input device</li>
                        <li><code>main_synth</code> → Maps to your configured output device</li>
                    </ul>
                    <p>Change hardware? Just update your device mappings in the <strong>Device Configuration</strong> tab - this workflow adapts automatically!</p>
                </div>
                
                <div style={{padding: '10px', background: '#f0f8ff', borderRadius: '5px'}}>
                    <strong>🚀 Dynamic Features:</strong>
                    <ul>
                        <li>Hot reloading without MIDI interruption</li>
                        <li>Real-time configuration changes</li>
                        <li>Template-based workflow creation</li>
                        <li>Performance optimized for &lt;10ms latency</li>
                    </ul>
                </div>
            </div>
        );
    });
});
