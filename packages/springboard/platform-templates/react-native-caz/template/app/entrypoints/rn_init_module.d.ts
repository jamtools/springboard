import {SpringboardRegistry} from 'springboard/engine/register';

/**
 * Accepts a SpringboardRegisry, which can be used to define modules to be registered
 * @param springboardRegistry - SpringboardRegistry
 */
declare function springboardEntrypoint(springboardRegistry: SpringboardRegistry): void;

export default springboardEntrypoint;
