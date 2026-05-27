import React from "react";
import ReactDOM from "react-dom/client";
import RootApp from "./RootApp";

// Self-hosted fonts — bundled by Vite, no CDN dependency
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/500.css";

import "./index.css";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
