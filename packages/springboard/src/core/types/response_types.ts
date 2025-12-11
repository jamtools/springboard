export type ErrorResponse = {
    error: string;
}

export const isErrorResponse = (response: object): response is ErrorResponse => {
    return 'error' in response;
};
