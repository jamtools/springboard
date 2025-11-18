<script module lang="ts">
    import springboard from 'springboard';

    import { getSelf } from './import_self';
    import { createSvelteReactElement } from '../../src/svelte_mounting';

    import { ModuleAPI } from 'springboard/engine/module_api';

    import '@jamtools/core/modules/macro_module/macro_module';

    declare module 'springboard/module_registry/module_registry' {
        interface AllModules {
            Main: Awaited<ReturnType<typeof createResources>>;
        }
    }

    const createResources = async (moduleAPI: ModuleAPI) => {
        const states = await moduleAPI.createStates({
            count: 0,
            name: "",
        });

        const actions = moduleAPI.createActions({
            increment: async (args: object): Promise<void> => {
                states.count.setState((value) => {
                    return value + 1;
                });
            },
            setName: async (args: { name: string }): Promise<void> => {
                states.name.setState(args.name);
            },
        });

        const macros = await moduleAPI.getModule('macro').createMacros(moduleAPI, {
            slider1: {
                type: 'midi_control_change_input',
                config: {
                    onTrigger: async (midiEvent) => {
                        actions.increment({});
                    },
                },
            },
            slider2: {
                type: 'midi_control_change_input',
                config: {},
            },
        });

        return {
            states,
            actions,
            macros,
        };
    };

    springboard.registerModule('Main', {}, async (app) => {
        const props = {app};
        app.registerRoute('/', {}, function () {
            const self = getSelf();
            return createSvelteReactElement(self, props);
        });

        return createResources(app);
    });
</script>

<script lang="ts">
    import { stateSupervisorToStore } from '../../src/svelte_store_helpers';

    import ReactInSvelte from '../../src/ReactInSvelte.svelte';
    import ExampleReactComponent from './example_react_component';

    let { app }: { app: ModuleAPI } = $props();

    const main = app.getModule('Main');

    const slider1 = main.macros.slider1;

    const count = stateSupervisorToStore(main.states.count);
    const name = stateSupervisorToStore(main.states.name);

    const actions = main.actions;

    async function increment() {
        await actions.increment({});
    }
</script>

<h1>{$count}</h1>
<button onclick={increment}>Increment</button>

<p>{$name}</p>

<ReactInSvelte component={slider1.components.edit} props={{}} />
<ReactInSvelte component={ExampleReactComponent} props={{someProp: 'test'}} />
