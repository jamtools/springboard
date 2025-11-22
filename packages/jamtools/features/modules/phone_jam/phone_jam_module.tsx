import React from 'react';

import springboard from 'springboard';

springboard.registerModule('phone_jam', {}, async (moduleAPI) => {
    const outputMacro = await moduleAPI.getModule('macro').createMacro(moduleAPI, 'local_output', 'musical_keyboard_output', {allowLocal: true});

    const playSound = () => {
        outputMacro.send({type: 'noteon', number: 36, velocity: 100});

        setTimeout(() => {
            outputMacro.send({type: 'noteoff', number: 36});
        }, 1000);
    };

    moduleAPI.ui.registerRoute('', {}, () => {
        return (
            <PhoneJamView
                onClickPlaySound={playSound}
            />
        );
    });
});

type PhoneJamViewProps = {
    onClickPlaySound: () => void;
}

const PhoneJamView = (props: PhoneJamViewProps) => {
    return (
        <div>
            <h1>
                Phone jam yay man
            </h1>

            <div>
                <button
                    onClick={props.onClickPlaySound}
                >
                    Play sound
                </button>
            </div>
        </div>
    );
};
