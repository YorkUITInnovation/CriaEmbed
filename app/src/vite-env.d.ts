/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

namespace vite {
  interface ImportMeta {
    readonly env: {
      VITE_API_BASE_URL: string;
    };
  }
}