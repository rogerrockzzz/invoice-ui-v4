import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import "./i18n";
import App from "./App";
import { useWorld } from "./store/world";
import { useUi } from "./store/ui";

/* Test and demo hook: e2e specs reset the world through this (docs/PLAN-v4-M1.md §6.5). It is a
   prototype with mock data only, so the hook is always present. */
declare global {
  interface Window {
    __vida?: { reset: () => void; world: typeof useWorld; ui: typeof useUi };
  }
}
window.__vida = {
  reset: () => {
    useWorld.getState().reset();
    useUi.getState().reset();
  },
  world: useWorld,
  ui: useUi,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
