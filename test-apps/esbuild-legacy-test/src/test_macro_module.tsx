import springboard from 'springboard';
import '@jamtools/core/modules/macro_module/macro_module';

springboard.registerModule('TestMacro', {}, async (moduleAPI) => {
    // This should work if the module augmentation is loaded correctly
    const macroModule = await moduleAPI.getModule('macro');

    const {input, output} = await macroModule.createMacros(moduleAPI, {
        input: {type: 'musical_keyboard_input', config: {}},
        output: {type: 'musical_keyboard_output', config: {}},
    });

    // Test that evt is properly typed (not implicitly any)
    input.subject.subscribe(evt => {
        console.log('MIDI event received:', evt.event.number);
    });

    moduleAPI.registerRoute('', {}, () => {
        return <div>Test Macro Module</div>;
    });
});
