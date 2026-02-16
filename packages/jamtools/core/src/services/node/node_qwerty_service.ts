import {Subject} from 'rxjs';

import {QwertyCallbackPayload, QwertyService} from '@jamtools/core/types/io_types';

export class NodeQwertyService implements QwertyService {
    constructor() {
        // TODO: implement node qwerty service
    }

    onInputEvent = new Subject<QwertyCallbackPayload>();
}
