import { createApp } from "vue";
import App from "./App.vue";
import { initTheme } from "./composables/useTheme";
import { registerServiceWorker } from "./utils/pwa";
import "./style.css";

initTheme();
createApp(App).mount("#app");

if (__APP_PROD__) {
  registerServiceWorker();
}
