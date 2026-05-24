import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/ai.css";

const pathName = window.location.pathname || "/";
const baseName = pathName.startsWith("/yme") ? "/yme" : pathName.startsWith("/ai") ? "/ai" : "/";
window.__YENKASA_WORKSPACE__ = baseName === "/yme" ? "yme" : "ai";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={baseName}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
