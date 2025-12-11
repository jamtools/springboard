
export const watchForChanges = (reloadCss?: boolean, reloadJs?: boolean) => {
    new EventSource('http://localhost:8000/esbuild').addEventListener('change', e => {
        const {added} = JSON.parse(e.data) as {added: string[];};
        if (reloadCss && added.length === 2 && added.every(path => path.includes('.css'))) {
            for (const link of document.getElementsByTagName('link')) {
                const url = new URL(link.href);

                if (url.host === location.host && url.pathname.startsWith('/dist/index-')) {
                    const next = link.cloneNode() as HTMLLinkElement;
                    next.href = '/dist' + added[0] + '?' + Math.random().toString(36).slice(2);
                    next.onload = () => link.remove();
                    link.parentNode!.insertBefore(next, link.nextSibling);
                    return;
                }
            }
        }

        if (reloadJs && added.length === 2 && added.every(path => path.includes('.js'))) {
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    });
};
