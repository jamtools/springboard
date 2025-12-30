import React, {act} from 'react';

import {fireEvent, render, within} from '@testing-library/react';
import {Subject} from 'rxjs';
import { screen } from 'shadow-dom-testing-library';
import '@testing-library/jest-dom';
import {MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {makeMockCoreDependencies, makeMockExtraDependences} from 'springboard/test/mock_core_dependencies';

import {Main} from 'springboard/platforms/browser';
import {Springboard} from 'springboard/engine/engine';
import {setIoDependencyCreator} from '../../../../modules/io/io_module';
import {MockMidiService} from '../../../../test/services/mock_midi_service';
import {MockQwertyService} from '../../../../test/services/mock_qwerty_service';

export const getMacroInputTestHelpers = () => {
    const setupTest = async (midiSubject: Subject<MidiEventFull>): Promise<Springboard> => {
        const coreDeps = makeMockCoreDependencies({store: {}});
        const extraDeps = makeMockExtraDependences();

        setIoDependencyCreator(async () => {
            const midi = new MockMidiService();
            midi.onInputEvent = midiSubject;

            return {
                midi,
                qwerty: new MockQwertyService(),
            };
        });

        const engine = new Springboard(coreDeps, extraDeps);

        const { container } = render(
            <Main
                engine={engine}
            />
            // <div id='yup'/>
        );

        // screen.debug();

        // const { container } = render(<MyComponent />);


        // await engine.initialize();
        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });
        await new Promise(r => setTimeout(r, 10));

        return engine;

    };

    const gotoMacroPage = async () => {
        const macroPageLink = screen.getByTestId('link-to-/modules/macro');
        // const macroPageLink = container.querySelector('a[href="/modules/macro/"]');
        expect(macroPageLink).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(macroPageLink!);
        });
    };

    const clickCapture = async (moduleId: string) => {
        const testModuleLabel = screen.getByTestId(`macro-module_registered-module-id_${moduleId}`);
        expect(testModuleLabel).toBeInTheDocument();

        const editMacroButton = within(testModuleLabel).getByText('Edit');
        expect(editMacroButton).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(editMacroButton);
        });

        const captureButton = within(testModuleLabel).getByText('Capture');
        await act(async () => {
            fireEvent.click(captureButton);
        });
    };

    const confirmCapture = async (moduleId: string) => {
        const testModuleLabel = screen.getByTestId(`macro-module_registered-module-id_${moduleId}`);
        expect(testModuleLabel).toBeInTheDocument();

        const confirmButton = within(testModuleLabel).getByText('Confirm');
        await act(async () => {
            fireEvent.click(confirmButton);
        });
    };

    const sendMidiMessage = async (midiSubject: Subject<MidiEventFull>, deviceName: string, midiEvent: MidiEvent) => {
        await act(async () => {
            midiSubject.next({
                type: 'midi',
                deviceInfo: {
                    type: 'midi',
                    name: deviceName,
                    manufacturer: 'some manufacturer',
                    subtype: 'midi_input',
                },
                event: midiEvent,
            });
        });
    };

    return {
        setupTest,
        clickCapture,
        confirmCapture,
        sendMidiMessage,
        gotoMacroPage,
    };
};
