import vue from "@vitejs/plugin-vue";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";

function sslWasRequested(env: Record<string, string>): boolean {
  return env.HTTPS === "true" || env.SSL_ENABLED === "true";
}

function resolveHttpsOptions(env: Record<string, string>) {
  if (!sslWasRequested(env)) {
    return undefined;
  }

  const sslDomain = env.SSL_DOMAIN?.trim();
  const sslCertPath =
    env.SSL_CERT_PATH?.trim() || (sslDomain ? `/etc/letsencrypt/live/${sslDomain}/fullchain.pem` : "");
  const sslKeyPath =
    env.SSL_KEY_PATH?.trim() || (sslDomain ? `/etc/letsencrypt/live/${sslDomain}/privkey.pem` : "");

  if (!sslCertPath || !sslKeyPath) {
    throw new Error("SSL_ENABLED=true requires SSL_CERT_PATH/SSL_KEY_PATH or SSL_DOMAIN.");
  }

  return {
    cert: readFileSync(sslCertPath),
    key: readFileSync(sslKeyPath)
  };
}

function precacheManifestPlugin(outDir: string, version: string): Plugin {
  return {
    name: "watson-precache-manifest",
    apply: "build",
    closeBundle() {
      const buildDir = path.resolve(process.cwd(), outDir);
      const urls = collectBuildUrls(buildDir)
        .filter((url) => url !== "/precache-manifest.json" && !url.endsWith(".map"))
        .sort();

      writeFileSync(path.join(buildDir, "precache-manifest.json"), JSON.stringify({ version, urls }, null, 2));
    }
  };
}

function collectBuildUrls(directory: string, root = directory): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      return collectBuildUrls(filePath, root);
    }

    return `/${path.relative(root, filePath).split(path.sep).join("/")}`;
  });
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const isProduction = mode === "production";
  const httpsOptions = command === "serve" ? resolveHttpsOptions(env) : undefined;
  const apiProtocol = command === "serve" && sslWasRequested(env) ? "https" : "http";
  const outDir = "dist";
  const appHost = isProduction ? (env.HOST ?? "0.0.0.0") : "127.0.0.1";
  const appPort = isProduction ? Number(env.PORT ?? 3131) : 3131;
  const apiProxyHost = env.API_PROXY_HOST ?? (appHost === "0.0.0.0" ? "127.0.0.1" : appHost);
  const webHost = isProduction ? (env.WEB_HOST ?? env.VITE_HOST ?? "0.0.0.0") : (env.WEB_HOST ?? "127.0.0.1");
  const webPort = isProduction ? Number(env.WEB_PORT ?? env.VITE_PORT ?? 5173) : Number(env.WEB_PORT ?? 5173);
  const apiBaseUrl = env.VITE_API_BASE_URL ?? "";

  return {
    define: {
      __APP_PROD__: JSON.stringify(isProduction),
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __API_BASE_URL__: JSON.stringify(apiBaseUrl),
      __API_PORT__: JSON.stringify(appPort)
    },
    plugins: [vue(), precacheManifestPlugin(outDir, packageJson.version)],
    resolve: {
      alias: {
        "#integrations": path.resolve(process.cwd(), "integrations")
      }
    },
    server: {
      host: webHost,
      port: webPort,
      https: httpsOptions,
      proxy: {
        "/api": {
          target: `${apiProtocol}://${apiProxyHost}:${appPort}`,
          secure: false
        }
      }
    },
    build: {
      outDir
    }
  };
});
