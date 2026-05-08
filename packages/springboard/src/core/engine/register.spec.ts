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

    it('falls back to a no-op entrypoint when no descriptor export is provided yet', () => {
        const descriptor = getApplicationDescriptorFromExports({});

        expect(isEntrypointDescriptor(descriptor)).toBe(true);
    });

    it('throws when the preferred export is not a Springboard descriptor', () => {
        expect(() => {
            getApplicationDescriptorFromExports({
                default: 'nope',
            });
        }).toThrow('Springboard application entrypoint must export either a defineModule descriptor or a springboard.entrypoint descriptor.');
    });
});
