import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App";

// Clear any legacy theme preference from localStorage. The application is
// permanently light-themed; data-theme="light" is set directly in index.html.
if (typeof window !== "undefined") {
  localStorage.removeItem("nexus-theme");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
