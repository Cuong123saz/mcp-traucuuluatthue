import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * The REST API (src/taxlaw/http) does not send CORS headers, so the browser
 * talks to the Vite server on the same origin and Vite forwards `/api/*` to
 * the backend. TAXLAW_API_PROXY_TARGET is read by Node only; it never reaches
 * the browser bundle.
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const target = env.TAXLAW_API_PROXY_TARGET || "http://127.0.0.1:3000";
    const proxy = {
        "/api": {
            target,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api/, "")
        }
    };

    return {
        plugins: [vue()],
        server: { port: 5173, proxy },
        preview: { port: 4173, proxy },
        test: {
            environment: "happy-dom",
            include: ["tests/**/*.test.ts"]
        }
    };
});
