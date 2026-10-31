import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "next-themes";
import "./index.css";
import App from "./App";
import { AuthRoot } from "./lib/privy";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" storageKey="ms-theme-choice" defaultTheme="light" enableSystem={false}>
      <AuthRoot><App /></AuthRoot>
    </ThemeProvider>
  </React.StrictMode>,
);
