import {ErrorResponse, isErrorResponse} from 'springboard/types/response_types';

type UltimateGuitarServiceResponse = {
    data: string;
} | ErrorResponse;

export class UltimateGuitarService {
    constructor() {}

    public getChordsTabForUrl = async (url: string): Promise<UltimateGuitarServiceResponse> => {
        return this.fetchUrl(url);
    };

    public getOfficialTabForId = async (id: string): Promise<UltimateGuitarServiceResponse> => {
        const url = `https://api-web.ultimate-guitar.com/v1/tab/pro/meta?id=${id}`;
        return this.fetchUrl(url);
    };

    private fetchUrl = async (url: string): Promise<UltimateGuitarServiceResponse> => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return {
                    error: `Failed to fetch chords tab. Status: ${response.statusText}`,
                };
            }

            const data = await response.text();
            return {data};
        } catch (e) {
            return {
                error: `Failed to fetch chords tab: '${(e as Error).message}'`,
            };
        }
    };
}
