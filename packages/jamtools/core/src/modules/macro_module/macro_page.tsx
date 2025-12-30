import React from 'react';
import {MacroConfigState} from './macro_module';

type Props = {
    state: MacroConfigState;
}

export const MacroPage = (props: Props) => {
    const moduleIds = Object.keys(props.state.configs);

    return (
        <ul>
            {moduleIds.map((moduleId) => {
                const c = props.state.configs[moduleId]!;
                const fieldNames = Object.keys(c);

                return (
                    <li
                        key={moduleId}
                        data-testid={`macro-module_registered-module-id_${moduleId}`}
                        style={{
                            maxWidth: '400px',
                        }}
                    >
                        <details>
                            <summary>{moduleId}</summary>
                            <ul>
                                {fieldNames.map((fieldName) => {
                                    const mapping = c[fieldName]!;
                                    const producedMacro = props.state.producedMacros[moduleId]![fieldName];
                                    const maybeComponents = (producedMacro as {components?: {edit: React.ElementType}} | undefined);

                                    return (
                                        <li key={fieldName} style={{margin: '20px', border: '1px solid', padding: '20px'}}>
                                            {maybeComponents?.components && <maybeComponents.components.edit/>}
                                            {fieldName} - {mapping.type}
                                        </li>
                                    );
                                })}
                            </ul>
                        </details>
                    </li>
                );
            })}
        </ul>
    );
};
