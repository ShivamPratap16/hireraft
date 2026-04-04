/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_ANALYTICS?: string
  readonly VITE_ANALYTICS_SCRIPT_URL?: string
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
