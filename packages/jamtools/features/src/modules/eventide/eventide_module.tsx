import React, {useEffect, useMemo, useState} from 'react';

import springbord from 'springboard';
import '@jamtools/core/modules/macro_module/macro_module';

import './index.css';

import {TIMEFACTOR_PRESETS} from './timefactor_preset_constants';

type EventidePresetState = {
    name: string;
    bankNumber: number;
    subBankNumber: number;
}

springbord.registerModule('Eventide', {}, async (moduleAPI) => {
    const currentPresetState = await moduleAPI.statesAPI.createPersistentState<EventidePresetState | null>('currentPresetState', null);
    const favoritedPresetsState = await moduleAPI.statesAPI.createPersistentState<string[]>('favoritedPresets', []);

    const macroModule = moduleAPI.deps.module.moduleRegistry.getModule('macro');
    const eventideMacro = await macroModule.createMacro(moduleAPI, 'eventide_pedal', 'musical_keyboard_output', {});

    const changePreset = moduleAPI.createAction('changePreset', {}, async (args: EventidePresetState) => {
        currentPresetState.setState(args);
        const programNumber = ((args.bankNumber - 1) * 2) + (args.subBankNumber - 1);

        eventideMacro.send({
            type: 'program',
            number: programNumber,
        });
    });

    const changePresetByName = moduleAPI.createAction('changePresetByName', {}, async (args: {presetName: string}) => {
        const words = args.presetName.split(' ');
        const bankParts = words[0].split(':');

        changePreset({
            name: '',
            bankNumber: parseInt(bankParts[0]),
            subBankNumber: parseInt(bankParts[1]),
        });
    });

    const togglePresetFavorited = moduleAPI.createAction('togglePresetFavorited', {}, async (args: {presetName: string}) => {
        favoritedPresetsState.setState(currentState => {
            const index = currentState.indexOf(args.presetName);
            if (index !== -1) {
                return [
                    ...currentState.slice(0, index),
                    ...currentState.slice(index + 1),
                ];
            }

            return [...currentState, args.presetName];
        });
    });

    const DisplayPreset = (props: {
        presetName: string;
    }) => {
        return (
            <li
                onClick={() => changePresetByName({presetName: props.presetName})}
                style={{cursor: 'pointer'}}
            >
                {props.presetName}
            </li>
        );
    };

    // hideNavbar should really be "hideApplicationShell", and also be a global option
    moduleAPI.registerRoute('', {hideApplicationShell: false}, () => {
        const currentPreset = currentPresetState.useState();
        const favoritedPresets = favoritedPresetsState.useState();

        const [formState, setFormState] = useState<EventidePresetState>(currentPreset || {name: '', bankNumber: 1, subBankNumber: 1});

        useEffect(() => {
            if (currentPreset) {
                setFormState(currentPreset);
            }
        }, [currentPreset]);

        const presetIndex = useMemo(() => {
            if (!currentPreset) {
                return 0;
            }

            return ((currentPreset.bankNumber - 1) * 2) + (currentPreset.subBankNumber - 1);
        }, [currentPreset]);

        const selectedPresetName = TIMEFACTOR_PRESETS[presetIndex];

        const isFavorited = useMemo(() => {
            if (!selectedPresetName) {
                return false;
            }

            return favoritedPresets.includes(selectedPresetName);
        }, [selectedPresetName, favoritedPresets]);

        return (
            <div>
                <eventideMacro.components.edit />
                {selectedPresetName && (
                    <>
                        <h3>
                            {selectedPresetName}
                        </h3>
                        Favorite
                        <input
                            type='checkbox'
                            checked={isFavorited}
                            onChange={() => {
                                togglePresetFavorited({presetName: selectedPresetName});
                            }}
                        />
                    </>
                )}

                <details>
                    <summary>
                        Favorite presets
                    </summary>
                    <ul>
                        {favoritedPresets.map(preset => (
                            <DisplayPreset
                                key={preset}
                                presetName={preset}
                            />
                        ))}
                    </ul>
                </details>

                <details>
                    <summary>
                        All presets
                    </summary>
                    <ul>
                        {TIMEFACTOR_PRESETS.map(preset => (
                            <DisplayPreset
                                key={preset}
                                presetName={preset}
                            />
                        ))}
                    </ul>
                </details>

                <details>
                    <summary>
                        Bank number form
                    </summary>
                    <div>
                        <div>
                            <label>Bank number</label>
                            <input
                                type='number'
                                min={1}
                                max={50}
                                value={formState.bankNumber}
                                onChange={e => setFormState(state => ({...state, bankNumber: parseInt(e.target.value)}))}
                            />
                        </div>
                        <div>
                            <label>Sub-bank number</label>
                            <input
                                type='number'
                                min={1}
                                max={2}
                                value={formState.subBankNumber}
                                onChange={e => setFormState(state => ({...state, subBankNumber: parseInt(e.target.value)}))}
                            />
                        </div>
                        <button
                            onClick={() => {
                                changePreset(formState);
                            }}
                        >
                            Submit
                        </button>
                    </div>
                </details>
            </div>
        );
    });
});
