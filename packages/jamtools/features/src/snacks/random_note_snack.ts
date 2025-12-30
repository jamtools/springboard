import springboard from 'springboard';

declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        RandomNote: RandomNoteModuleReturnValue;
    }
}

type RandomNoteModuleReturnValue = {
    togglePlaying: () => void;
}

springboard.registerModule('RandomNote', {}, async (moduleAPI): Promise<RandomNoteModuleReturnValue> => {
    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('macro');

    const inputTrigger = await macroModule.createMacro(moduleAPI, 'Input trigger', 'musical_keyboard_input', {enableQwerty: false});
    const output = await macroModule.createMacro(moduleAPI, 'Random output', 'musical_keyboard_output', {});

    let playing = false;
    let currentInterval: NodeJS.Timeout | undefined;

    const playRandomNote = () => {
        const randomNumber = Math.random();
        const scaled = Math.round(randomNumber * 48);
        const inOctave = scaled + 24;

        const randomVelocity = Math.floor(Math.random() * 128);

        output.send({
            number: inOctave,
            type: 'noteon',
            velocity: randomVelocity,
        });

        setTimeout(() => {
            output.send({
                number: inOctave,
                type: 'noteoff',
                velocity: 0,
            });
        }, 100);
    };

    const startPlaying = () => {
        currentInterval = setInterval(() => {
            // if (Math.random() < 0.7) {
            playRandomNote();
            // }
        }, 50);
    };

    const stopPlaying = () => {
        clearInterval(currentInterval);
    };

    const togglePlaying = () => {
        if (playing) {
            stopPlaying();
        } else {
            startPlaying();
        }

        playing = !playing;
    };

    inputTrigger.subject.subscribe((evt) => {
        if (evt.event.type !== 'noteon') {
            return;
        }

        togglePlaying();
    });

    return {
        togglePlaying,
    };
});
