/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PLATFORM: 'browser' | 'node' | 'partykit';
  readonly NODE_ENV: 'development' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    accept(): void;
    accept(deps: string[], callback: (modules: any[]) => void): void;
    dispose(callback: () => void): void;
  };
}

// Process env shim for browser
declare namespace NodeJS {
  interface ProcessEnv {
    PLATFORM?: string;
    NODE_ENV?: string;
    WS_HOST?: string;
    DATA_HOST?: string;
    PORT?: string;
    RELOAD_CSS?: string;
    RELOAD_JS?: string;
  }
}
