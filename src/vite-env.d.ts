/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_BASE_DOMAIN?: string;
  readonly VITE_PLATFORM_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
