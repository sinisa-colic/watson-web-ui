import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const appHost = env.HOST ?? "0.0.0.0";
  const appPort = Number(env.PORT ?? 3131);
  const apiProxyHost = env.API_PROXY_HOST ?? (appHost === "0.0.0.0" ? "127.0.0.1" : appHost);
  const webHost = env.WEB_HOST ?? env.VITE_HOST ?? "0.0.0.0";
  const webPort = Number(env.WEB_PORT ?? env.VITE_PORT ?? 5173);

  return {
    define: {
      __APP_PROD__: JSON.stringify(mode === "production"),
      __APP_VERSION__: JSON.stringify(packageJson.version)
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
