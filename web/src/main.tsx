import "./polyfills";
import React from "react";
import ReactDOM from "react-dom/client";
import "@unlocalhosted/metalui/icons.css";
import "@unlocalhosted/metalui/styles.css";
import "./tokens.css";
import "./styles.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
