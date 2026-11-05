/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'local' | 'rest'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
