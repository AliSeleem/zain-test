import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import "./index.css";
import App from "./App";
import SecondWindow from "./SecondWindow";

// Extra windows load the same bundle with a hash route.
const Root = window.location.hash.startsWith("#/second") ? SecondWindow : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
