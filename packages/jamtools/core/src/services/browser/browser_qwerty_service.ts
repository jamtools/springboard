import {Subject} from 'rxjs';

import {QwertyCallbackPayload, QwertyService} from '@jamtools/core/types/io_types';

export class BrowserQwertyService implements QwertyService {
    currentlyHeldDownKeys = new Set<string>();

    constructor(document: Document) {
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (this.currentlyHeldDownKeys.has(key)) {
                return;
            }

            this.currentlyHeldDownKeys.add(key);

            this.onInputEvent.next({
                event: 'keydown',
                key,
            });
        });

        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            this.currentlyHeldDownKeys.delete(key);

            this.onInputEvent.next({
                event: 'keyup',
                key,
            });
        });
    }

    onInputEvent = new Subject<QwertyCallbackPayload>();
}
