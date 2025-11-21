import React from 'react';

import springboard from 'springboard';

// import {GuitarComponent} from './song_structures/components/guitar';

springboard.registerModule('daw_interaction', {}, async (moduleAPI) => {
    const states = await moduleAPI.shared.createSharedStates({
        slider_position_1: 0,
        slider_position_2: 0,
    });
    const sliderPositionState1 = states.slider_position_1;
    const sliderPositionState2 = states.slider_position_2;

    const ccOutput1 = await moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro(moduleAPI, 'cc_output_1', 'midi_control_change_output', {});
    const ccOutput2 = await moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro(moduleAPI, 'cc_output_2', 'midi_control_change_output', {});

    moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro(moduleAPI, 'cc_input_1', 'midi_control_change_input', {
        allowLocal: true,
        onTrigger: (event => {
            if (event.event.value) {
                sliderPositionState1.setState(event.event.value);
                ccOutput1.send(event.event.value);
            }
        }),
    });

    moduleAPI.deps.module.moduleRegistry.getModule('macro').createMacro(moduleAPI, 'cc_input_2', 'midi_control_change_input', {
        allowLocal: true,
        onTrigger: (event => {
            if (event.event.value) {
                sliderPositionState2.setState(event.event.value);
                ccOutput2.send(event.event.value);
            }
        }),
    });

    const handleSliderDrag = moduleAPI.createAction('slider_drag', {}, async (args: {index: 0 | 1, value: number}) => {
        const output = [ccOutput1, ccOutput2][args.index];
        output.send(args.value);

        const state = [sliderPositionState1, sliderPositionState2][args.index];
        state.setState(args.value);
    });

    moduleAPI.registerRoute('', {}, () => {
        const sliderPosition1 = sliderPositionState1.useState();
        const sliderPosition2 = sliderPositionState2.useState();

        return (
            <DawInteractionPage
                sliderPosition1={sliderPosition1}
                sliderPosition2={sliderPosition2}
                handleSliderDrag={(index, value) => handleSliderDrag({index, value})}
            />
        );
    });
});

type DawInteractionPageProps = {
    sliderPosition1: number;
    sliderPosition2: number;
    handleSliderDrag: (index: 0 | 1, value: number) => void;
}

const DawInteractionPage = ({sliderPosition1, sliderPosition2, handleSliderDrag}: DawInteractionPageProps) => {
    const sliders = ([sliderPosition1, sliderPosition2] as const).map((position, i) => (
        <div
            key={i}
            style={{
                display: 'inline-block',
                width: '50px',
            }}
        >
            <input
                type='range'
                value={position}
                onChange={(e) => handleSliderDrag(i as 0 | 1, parseInt(e.target.value))}
                style={{writingMode: 'vertical-rl', direction: 'rtl'}}
            />
            <pre style={{display: 'inline'}}>{position}</pre>
        </div>
    ));

    return (
        <div>
            <div>
                {sliders}
            </div>
        </div>
    );
};
