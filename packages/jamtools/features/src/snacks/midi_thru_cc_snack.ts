import springboard from 'springboard';

springboard.registerModule('midi_thru_cc', {}, async (moduleAPI) => {
    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('macro');

    const [input, output] = await Promise.all([
        macroModule.createMacro(moduleAPI, 'MIDI Input', 'midi_control_change_input', {}),
        // macroModule.createMacro(moduleAPI, 'MIDI Input', 'musical_keyboard_input', {}),
        macroModule.createMacro(moduleAPI, 'MIDI Output', 'musical_keyboard_output', {}),
    ]);

    input.subject.subscribe(evt => {
        if (evt.event.value && evt.event.value % 2 === 1) {
            return;
        }

        const noteNumber = (evt.event.value || 0) / 2;

        output.send({
            ...evt.event,
            type: 'noteon',
            number: noteNumber,
            velocity: 100,
        });

        setTimeout(() => {
            output.send({
                ...evt.event,
                type: 'noteoff',
                number: noteNumber,
                velocity: 0,
            });
        }, 50);
    });

    // input.onEventSubject.subscribe(evt => {
    //     output.send(evt.event);
    // });
});
