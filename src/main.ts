import { createApp } from "vue";
import App from "./App.vue";
import { registerServiceWorker } from "./utils/pwa";
import "./style.css";

createApp(App).mount("#app");

if (__APP_PROD__) {
  registerServiceWorker();
}
