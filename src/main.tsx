import React from "react";
import { Buffer } from "buffer";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// @solana/web3.js expects Buffer/process to exist in the browser.
if (typeof window !== "undefined") {
  const w = window as unknown as Record<string, unknown>;
  w.Buffer = w.Buffer ?? Buffer;
  w.global = w.global ?? window;
  w.process = w.process ?? { env: {} };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
