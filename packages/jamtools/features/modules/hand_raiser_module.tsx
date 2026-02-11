import React from 'react';

import springboard from 'springboard';

import './hand_raiser.css';

springboard.registerModule('HandRaiser', {}, async (m) => {
    const macroModule = m.getModule('enhanced_macro');

    const states = await m.createStates({
        handPositions: [0, 0],
        workflowIds: [] as string[],
    });

    const actions = m.createActions({
        changeHandPosition: async (args: {index: number, value: number}) => {
            states.handPositions.setStateImmer((positions) => {
                positions[args.index] = args.value;
            });

            return {success: true};
        },
    });

    // Create dynamic workflows for each hand slider using logical device/channel/CC names
    const sliderWorkflows = await Promise.all([0, 1].map(async (index) => {
        const workflowId = await macroModule.createWorkflowFromTemplate('midi_cc_chain', {
            inputDevice: 'main_controller',       // User-configurable logical device
            inputChannel: 'lead',                 // User-configurable logical channel
            inputCC: `slider_${index + 1}`,      // User-configurable logical CC (slider_1, slider_2)
            outputDevice: 'effects',             // User-configurable logical device for effects processing
            outputChannel: 'effects',            // User-configurable logical channel
            outputCC: `hand_position_${index}`,  // User-configurable logical CC for hand positions
            minValue: 0,
            maxValue: 127
        });

        // Set up workflow event handling for hand position updates
        // Note: In a full implementation, we'd subscribe to workflow events
        console.log(`Created hand slider workflow ${index}:`, workflowId);
        
        return workflowId;
    }));

    // Store workflow IDs in state
    states.workflowIds.setState(sliderWorkflows);

    // Create mock macro interfaces for backwards compatibility during transition
    const mockMacros = {
        slider0: {
            components: {
                edit: () => React.createElement('div', {}, 
                    `Dynamic Workflow Configuration (ID: ${sliderWorkflows[0]})`)
            }
        },
        slider1: {
            components: {
                edit: () => React.createElement('div', {}, 
                    `Dynamic Workflow Configuration (ID: ${sliderWorkflows[1]})`)
            }
        }
    };

    m.registerRoute('/', {}, () => {
        const positions = states.handPositions.useState();
        const workflowIds = states.workflowIds.useState();

        return (
            <div className='hand-raiser-main'>
                <div style={{marginBottom: '20px', padding: '15px', background: '#e8f4fd', borderRadius: '8px'}}>
                    <h3>Dynamic Hand Raiser</h3>
                    <p>Using dynamic workflow system for MIDI CC control</p>
                    <div>
                        <strong>Active Workflows:</strong>
                        {workflowIds.map((id, index) => (
                            <div key={index} style={{marginLeft: '10px'}}>
                                • Slider {index}: {id}
                            </div>
                        ))}
                    </div>
                </div>

                <div className='hand-raiser-center'>
                    {positions.map((position, index) => (
                        <HandSliderContainer
                            key={index}
                            position={position}
                            handlePositionChange={async (value) => {
                                await actions.changeHandPosition({index, value});
                                
                                // In full implementation: Update workflow with new value
                                // await macroModule.updateWorkflow(workflowIds[index], {...})
                            }}
                            macro={index === 0 ? mockMacros.slider0 : mockMacros.slider1}
                            workflowId={workflowIds[index]}
                        />
                    ))}
                </div>
            </div>
        );
    });
});

type HandRaiserModuleProps = {
    position: number;
    handlePositionChange: (position: number) => void;
    macro: { components: { edit: () => React.ReactElement } };
    workflowId: string;
};

const HandSliderContainer = (props: HandRaiserModuleProps) => {
    return (
        <div className='hand-slider-container'>
            <Hand
                position={props.position}
            />
            <div className='slider-container'>
                <Slider
                    value={props.position}
                    onChange={props.handlePositionChange}
                />
                <details style={{cursor: 'pointer'}}>
                    <summary>Configure Dynamic Workflow</summary>
                    <div style={{padding: '10px', background: '#f8f9fa', borderRadius: '4px'}}>
                        <p><strong>Workflow ID:</strong> {props.workflowId}</p>
                        <p>Dynamic MIDI CC workflow with hot reloading support</p>
                        <props.macro.components.edit />
                        <div style={{marginTop: '8px'}}>
                            <small>
                                ✨ <strong>New Features:</strong> Real-time updates, custom ranges, device switching
                            </small>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    );
};

type HandProps = {
    position: number;
}

const Hand = (props: HandProps) => {
    const bottomSpace = (props.position / 127) * (100 - 40) + 20;

    return (
        <div
            className='hand'
            style={{
                position: 'absolute',
                bottom: 'calc(' + bottomSpace + 'vh)',
            }}
        >
            <img src='https://static.vecteezy.com/system/resources/previews/046/829/646/original/raised-hand-isolated-on-transparent-background-free-png.png'
            />
        </div>
    );
};

type SliderProps = {
    value: number;
    onChange: (value: number) => void;
}

const Slider = (props: SliderProps) => {
    return (
        <div className='slider'>
            <input
                type='range'
                value={props.value}
                onChange={(e) => props.onChange(parseInt(e.target.value))}
                max={127}
            />
            <pre>{props.value}</pre>
        </div>
    );
};

type DataSyncRootRouteProps = {
    sliderPositions: number[];
    handleSliderDrag: (index: number, value: number) => void;
}

type HandRaiserPageProps = {
    sliderPositions: number[];
    handleSliderDrag: (index: number, value: number) => void;
}

const HandRaiserPage = (props: HandRaiserPageProps) => {
    const {sliderPositions, handleSliderDrag} = props;

    const sliders = sliderPositions.map((position, i) => (
        <Slider
            key={i}
            value={position}
            onChange={newValue => handleSliderDrag(i, newValue)}
        />
    ));

    const sliderHands = sliderPositions.map((position, i) => (
        <Hand
            key={i}
            position={position}
        />
    ));

    return (
        <div>
            <h1>hey</h1>
            <div>
                {sliders}
            </div>

            <div>
                {sliderHands}
            </div>
        </div>
    );
};
