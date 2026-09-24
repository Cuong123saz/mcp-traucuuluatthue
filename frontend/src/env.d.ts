/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_TAXLAW_API_BASE_URL?: string;
    readonly VITE_TAXLAW_API_TIMEOUT_MS?: string;
}

declare module "*.vue" {
    import type { DefineComponent } from "vue";
    const component: DefineComponent<object, object, unknown>;
    export default component;
}
