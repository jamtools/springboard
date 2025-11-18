<script lang="ts" generics="TProps extends Record<string, any> = Record<string, any>">
    import { onMount, onDestroy } from 'svelte';
    import React from 'react';
    import ReactDOM from 'react-dom/client';

    export let component: React.ElementType<TProps>;
    export let props: TProps = {} as TProps;

    let container: HTMLDivElement;
    let root: ReactDOM.Root;

    onMount(() => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(component, props));
    });

    onDestroy(() => {
        root?.unmount();
    });
</script>

<div bind:this={container}></div>
