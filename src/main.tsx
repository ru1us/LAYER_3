import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { SettingsProvider } from "./components/SettingsContext.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <SettingsProvider>
    <App />
  </SettingsProvider>
);
