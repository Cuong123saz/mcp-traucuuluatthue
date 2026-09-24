import { createApp } from "vue";
import App from "./App.vue";
import { createTaxLawApi } from "./lib/taxLawApi";
import { createSearchStore } from "./stores/searchStore";
import "./style.css";

const timeout = Number(import.meta.env.VITE_TAXLAW_API_TIMEOUT_MS);
const api = createTaxLawApi({
    baseUrl: import.meta.env.VITE_TAXLAW_API_BASE_URL || "/api",
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 10_000
});

createApp(App, { store: createSearchStore(api) }).mount("#app");
