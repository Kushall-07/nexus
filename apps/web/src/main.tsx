import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App";
import { initTheme } from "./lib/theme";

// Apply persisted theme before React renders to prevent flash of wrong theme.
// initTheme() is SSR-safe (no-ops in non-browser environments).
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
