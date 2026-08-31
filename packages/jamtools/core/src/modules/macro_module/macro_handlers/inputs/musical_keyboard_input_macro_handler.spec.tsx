import {act} from 'react';

import { screen } from 'shadow-dom-testing-library';
import '@testing-library/jest-dom';

import springboard from 'springboard/core/engine/register';
import {Springboard} from 'springboard/engine/engine';

import {makeMockCoreDependencies} from 'springboard/core/test/mock_core_dependencies';
import {Subject} from 'rxjs';
import {QwertyCallbackPayload} from '../../../../types/io_types.js';
import {MidiEventFull} from '../../macro_module_types.js';
import {MockQwertyService} from '../../../../test/services/mock_qwerty_service.js';
import {MockMidiService} from '../../../../test/services/mock_midi_service.js';
import {ioModule, setIoDependencyCreator} from '../../../io/io_module.js';
import {macroModule} from '../../macro_module.js';
import {macroTypeRegistry} from '../../registered_macro_types.js';

import {getMacroInputTestHelpers} from './macro_input_test_helpers.js';

describe('MusicalKeyboardInputMacroHandler', () => {
    beforeEach(() => {
        springboard.reset();
        macroTypeRegistry.reset();
    });

    it('should handle qwerty events', async () => {
        const coreDeps = makeMockCoreDependencies({store: {}});

        const qwertySubject = new Subject<QwertyCallbackPayload>();

        const mockQwerty = new MockQwertyService();
        mockQwerty.onInputEvent = qwertySubject;
        const mockMidi = new MockMidiService();

        setIoDependencyCreator(async () => ({
            qwerty: mockQwerty,
            midi: mockMidi,
        }));

        // coreDeps.inputs.qwerty.onInputEvent = qwertySubject;

        const engine = new Springboard(coreDeps);
        await engine.registerDescriptor(ioModule);
        await engine.registerDescriptor(macroModule);
        await engine.initialize();

        const calls: MidiEventFull[] = [];

        await engine.registerModule('Test_MusicalKeyboardInputMacro', {}, async (moduleAPI) => {
            const macroModule = moduleAPI.getModule('macro');
            const midiInput = await macroModule.createMacro(moduleAPI, 'myinput', 'musical_keyboard_input', {enableQwerty: true});
            midiInput.subject.subscribe(event => {
                calls.push(event);
            });

            return {};
        });

        expect(calls).toHaveLength(0);

        qwertySubject.next({event: 'keydown', key: 'a'});
        // await new Promise(r => setTimeout(r, 1000));
        // expect(calls).toHaveLength(0);
        expect(calls).toHaveLength(1);
    });

    it('should handle midi events', async () => {
        const helpers = getMacroInputTestHelpers();
        const midiSubject = new Subject<MidiEventFull>();

        const engine = await helpers.setupTest(midiSubject);
        const moduleId = 'Test_MusicalKeyboardInputMacro';

        const calls: MidiEventFull[] = [];

        await act(async () => {
            await engine.registerModule(moduleId, {}, async (moduleAPI) => {
                const macroModule = moduleAPI.getModule('macro');
                const midiInput = await macroModule.createMacro(moduleAPI, 'myinput', 'musical_keyboard_input', {});
                midiInput.subject.subscribe(event => {
                    calls.push(event);
                });

                return {};
            });
        });

        await helpers.gotoMacroPage();

        // # Start capture
        await helpers.clickCapture(moduleId);

        // # Purposely send irrelevant cc midi event
        await helpers.sendMidiMessage(midiSubject, 'some_midi_input', {
            type: 'cc',
            number: 12,
            channel: 1,
        });

        // * Assert no relevant event as been captured
        let captureOutput = screen.queryByTestId('captured_event');
        expect(captureOutput).not.toBeInTheDocument();

        // # Purposely send relevant noteon midi event
        await helpers.sendMidiMessage(midiSubject, 'some_midi_input', {
            type: 'noteon',
            number: 12,
            channel: 1,
        });

        // * Assert event has been captured
        captureOutput = screen.queryByTestId('captured_event');
        expect(captureOutput).toBeInTheDocument();
        expect(captureOutput?.textContent).toEqual('some_midi_input|1|12');

        // # Confirm the captured event
        await helpers.confirmCapture(moduleId);

        // # Send noteon event from wrong midi input
        await helpers.sendMidiMessage(midiSubject, 'some_other_midi_input', {
            type: 'noteon',
            number: 12,
            channel: 1,
        });
        expect(calls).toHaveLength(0);

        // # Send noteon event from wrong midi channel
        await helpers.sendMidiMessage(midiSubject, 'some_midi_input', {
            type: 'noteon',
            number: 12,
            channel: 2,
        });
        expect(calls).toHaveLength(0);

        // # Send irrelevant cc midi event
        await helpers.sendMidiMessage(midiSubject, 'some_midi_input', {
            type: 'cc',
            number: 12,
            channel: 1,
        });
        expect(calls).toHaveLength(0);

        // # Send correct noteon events
        await helpers.sendMidiMessage(midiSubject, 'some_midi_input', {
            type: 'noteon',
            number: 12,
            channel: 1,
        });
        await helpers.sendMidiMessage(midiSubject, 'some_midi_input', {
            type: 'noteon',
            number: 13,
            channel: 1,
        });
        expect(calls).toHaveLength(2);
    });
});
