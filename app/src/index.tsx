import React from "react";
import ReactDOM from "react-dom/client";
import { AppProviders } from "@/contexts";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
