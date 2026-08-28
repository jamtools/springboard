import springboard from '../engine/register.js';
import {makeMockCoreDependencies, makeMockSpringboardEngine} from './mock_core_dependencies.js';
import {defineRoute, defineRoutes} from '../../router/index.js';

beforeEach(() => {
    springboard.reset();
});

describe('mock_core_dependencies', () => {
    it('can create mock core dependencies without explicitly passing a store', async () => {
        const coreDeps = makeMockCoreDependencies();

        await coreDeps.storage.remote.set('answer', 42);

        await expect(coreDeps.storage.remote.get('answer')).resolves.toBe(42);
    });

    it('initializes defineModule descriptors with a mock Springboard engine', async () => {
        const engine = await makeMockSpringboardEngine({
            descriptors: springboard.defineModule('StorybookFixture', {}, async () => ({
                routes: defineRoutes([
                    defineRoute({
                        path: '/storybook-fixture',
                        component: () => null,
                    }),
                ]),
            })),
        });

        expect(engine.moduleRegistry.getCustomModule('StorybookFixture')).toBeTruthy();
    });

    it('initializes entrypoint descriptors with a mock Springboard engine', async () => {
        const initialized: string[] = [];
        const engine = await makeMockSpringboardEngine({
            descriptors: springboard.entrypoint(async ({register}) => {
                await register(springboard.defineModule('NestedFixture', {}, async () => {
                    initialized.push('NestedFixture');
                    return {};
                }));
            }),
        });

        expect(initialized).toEqual(['NestedFixture']);
        expect(engine.moduleRegistry.getCustomModule('NestedFixture')).toBeTruthy();
    });
});
