interface LocalStorageDependency {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    clear(): void;
}

const DEFAULT_LOCAL_STORAGE_KEY = 'RN_STORED_TOKEN';

export class ReactNativeWebviewLocalTokenService {
    public token: string | null = null;

    constructor(
        private localStorageKey = DEFAULT_LOCAL_STORAGE_KEY,
        private localStorageDep: LocalStorageDependency = localStorage
    ) {
        const storedValue = localStorageDep.getItem(localStorageKey);
        if (storedValue) {
            this.token = storedValue;
        }
    }

    setToken = (token: string) => {
        this.token = token;
        this.localStorageDep.setItem(this.localStorageKey, token);
    };

    makeAuthHeaders = () => {
        if (!this.token) {
            return null;
        }

        return {
            Authorization: `Bearer ${this.token}`,
        } as const;
    };

    makeQueryParams = () => {
        if (!this.token) {
            return null;
        }

        return new URLSearchParams({
            auth_token: this.token,
        });
    };
}
