/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEV_TENANT?: string;
  readonly VITE_APP_BASE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
