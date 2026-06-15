import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SimProvider } from "./state/sim";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SimProvider>
      <App />
    </SimProvider>
  </React.StrictMode>
);
