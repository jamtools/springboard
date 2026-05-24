import {Subject} from 'rxjs';

import {QwertyCallbackPayload, QwertyService} from '@jamtools/core/types/io_types';

export class MockQwertyService implements QwertyService {
    onInputEvent = new Subject<QwertyCallbackPayload>();

    initialize = async () => {};
}
