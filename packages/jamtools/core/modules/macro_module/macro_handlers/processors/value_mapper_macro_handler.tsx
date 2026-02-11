import React from 'react';
import {Subject} from 'rxjs';

import {macroTypeRegistry} from '../../registered_macro_types';

type MacroConfigItemValueMapper = {
    inputRange?: [number, number];
    outputRange?: [number, number];
}

export type ValueMapperResult = {
    subject: Subject<{event: {value: number}}>;
    send: (value: number) => void;
};

declare module '../../macro_module_types' {
    interface MacroTypeConfigs {
        value_mapper: {
            input: MacroConfigItemValueMapper;
            output: ValueMapperResult;
        }
    }
}

macroTypeRegistry.registerMacroType('value_mapper', {}, async (macroAPI, conf, fieldName) => {
    const subject = new Subject<{event: {value: number}}>();
    
    const send = (value: number) => {
        const inputRange = conf.inputRange || [0, 127];
        const outputRange = conf.outputRange || [0, 127];
        
        // Map input range to output range
        const inputMin = inputRange[0];
        const inputMax = inputRange[1];
        const outputMin = outputRange[0];
        const outputMax = outputRange[1];
        
        const normalized = (value - inputMin) / (inputMax - inputMin);
        const mappedValue = Math.round(outputMin + normalized * (outputMax - outputMin));
        const clampedValue = Math.max(outputMin, Math.min(outputMax, mappedValue));
        
        subject.next({event: {value: clampedValue}});
    };
    
    return {
        subject,
        send
    };
});