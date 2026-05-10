import springboard, {getApplicationDescriptorFromExports, isDefinedModuleDescriptor, isEntrypointDescriptor} from './register.js';

describe('register descriptors', () => {
    it('prefers a named entrypoint export over the default export', () => {
        const defaultModule = springboard.defineModule('Default', {}, async () => ({}));
        const namedEntrypoint = springboard.entrypoint(() => {});

        const descriptor = getApplicationDescriptorFromExports({
            default: defaultModule,
            entrypoint: namedEntrypoint,
        });

        expect(isEntrypointDescriptor(descriptor)).toBe(true);
    });

    it('reads a default module descriptor export', () => {
        const defaultModule = springboard.defineModule('Default', {}, async () => ({}));

        const descriptor = getApplicationDescriptorFromExports({
            default: defaultModule,
        });

        expect(isDefinedModuleDescriptor(descriptor)).toBe(true);
        if (!isDefinedModuleDescriptor(descriptor)) {
            throw new Error('Expected module descriptor');
        }
        expect(descriptor.moduleId).toBe('Default');
    });

    it('throws when no descriptor export is provided', () => {
        expect(() => {
            getApplicationDescriptorFromExports({}, 'test-entrypoint.ts');
        }).toThrow('Springboard test-entrypoint.ts must export a defineModule descriptor or a springboard.entrypoint descriptor from its default export. The module did not export any values.');
    });

    it('throws when the preferred export is not a Springboard descriptor', () => {
        expect(() => {
            getApplicationDescriptorFromExports({
                default: 'nope',
            }, 'test-entrypoint.ts');
        }).toThrow('Springboard test-entrypoint.ts exported an unsupported value from its default export. Expected a defineModule descriptor or a springboard.entrypoint descriptor. Available exports: default.');
    });
});
