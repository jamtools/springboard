import React from 'react';
import type {ComponentProps} from 'svelte';

interface SvelteComponentWrapperProps<T extends Component<any>> {
    component: T;
    props: ComponentProps<T>;
}

export const createSvelteReactElement = <T extends Component<any>>(component: T, props: ComponentProps<T>) => {
    return React.createElement(SvelteComponentWrapper<T>, {component, props});
};

function SvelteComponentWrapper<T extends Component<any>>({
    component,
    props,
}: SvelteComponentWrapperProps<T>): React.ReactNode {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const svelteInstanceRef = React.useRef<ReturnType<typeof mountSvelteComponent<T>> | null>(null);

    React.useEffect(() => {
        if (containerRef.current && !svelteInstanceRef.current) {
            svelteInstanceRef.current = mountSvelteComponent(component, containerRef.current, props);
        }
        return () => {
            if (svelteInstanceRef.current) {
                unmountSvelteComponent(svelteInstanceRef.current, { outro: true });
            }
        };
    }, [component]);

    return React.createElement('div', {ref: containerRef});
}

export default SvelteComponentWrapper;

import {mount, unmount, type Component} from 'svelte';

export function mountSvelteComponent<T extends Component<any>>(
    Component: T,
    target: HTMLElement,
    props: ComponentProps<T>
): ReturnType<typeof mount> {
    return mount(Component, {
        target,
        props,
    });
}

export function unmountSvelteComponent(
    instance: ReturnType<typeof mount>,
    options: {outro?: boolean} = {}
): void {
    unmount(instance, options);
}
