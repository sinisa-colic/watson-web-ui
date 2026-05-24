import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const isProduction = mode === "production";
  const appHost = isProduction ? (env.HOST ?? "0.0.0.0") : "127.0.0.1";
  const appPort = isProduction ? Number(env.PORT ?? 3131) : 3131;
  const apiProxyHost = env.API_PROXY_HOST ?? (appHost === "0.0.0.0" ? "127.0.0.1" : appHost);
  const webHost = isProduction ? (env.WEB_HOST ?? env.VITE_HOST ?? "0.0.0.0") : "127.0.0.1";
  const webPort = isProduction ? Number(env.WEB_PORT ?? env.VITE_PORT ?? 5173) : 5173;
  const apiBaseUrl = env.VITE_API_BASE_URL ?? (isProduction ? "" : "http://127.0.0.1:3131");

  return {
    define: {
      __APP_PROD__: JSON.stringify(isProduction),
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __API_BASE_URL__: JSON.stringify(apiBaseUrl),
      __API_PORT__: JSON.stringify(appPort)
    },
    plugins: [vue()],
    server: {
      host: webHost,
      port: webPort,
      proxy: {
        "/api": `http://${apiProxyHost}:${appPort}`
      }
    },
    build: {
      outDir: "dist"
    }
  };
});
