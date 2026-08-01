import React, {act} from 'react';

import {fireEvent, render, within, waitFor} from '@testing-library/react';
import {Subject} from 'rxjs';
import { screen } from 'shadow-dom-testing-library';
import '@testing-library/jest-dom';
import {MidiEvent, MidiEventFull} from '@jamtools/core/modules/macro_module/macro_module_types';
import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';

import {Springboard, SpringboardProviderPure} from 'springboard/engine/engine';
import {setIoDependencyCreator} from '../../../../modules/io/io_module.js';
import {MockMidiService} from '../../../../test/services/mock_midi_service.js';
import {MockQwertyService} from '../../../../test/services/mock_qwerty_service.js';

export const getMacroInputTestHelpers = () => {
    const setupTest = async (midiSubject: Subject<MidiEventFull>): Promise<Springboard> => {
        const coreDeps = makeMockCoreDependencies({store: {}});

        setIoDependencyCreator(async () => {
            const midi = new MockMidiService();
            midi.onInputEvent = midiSubject;

            return {
                midi,
                qwerty: new MockQwertyService(),
            };
        });

        const engine = new Springboard(coreDeps);
        await engine.initialize();
        const macroModule = engine.moduleRegistry.getModule('macro');
        const MacroRouteComponent = macroModule.routes!['']!.component;

        render(
            <SpringboardProviderPure engine={engine}>
                <MacroRouteComponent />
            </SpringboardProviderPure>
        );
        await waitFor(() => {
            expect(screen.getByRole('list')).toBeInTheDocument();
        });

        return engine;

    };

    const gotoMacroPage = async () => {
        return;
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
