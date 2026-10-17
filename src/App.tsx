import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type DbConfig } from "./api";
import { applyLang, type Lang } from "./i18n";
import type { NumberStyle } from "./numbers";
import { Button } from "./ui";
import ConnectionScreen from "./screens/ConnectionScreen";
import LangTab from "./screens/LangTab";
import SessionsTab from "./screens/SessionsTab";
import GridTab from "./screens/GridTab";
import WindowsTab from "./screens/WindowsTab";

type Tab = "lang" | "sessions" | "grid" | "windows";

export default function App() {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<DbConfig | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [initialError, setInitialError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>("lang");
  const [numberStyle, setNumberStyle] = useState<NumberStyle>("latn");
  const [machine, setMachine] = useState("");

  useEffect(() => {
    api.machineName().then(setMachine);
    // Try the saved connection first; only show the form if it's missing or fails.
    api.connectSaved().then((r) => {
      setConfig(r.config);
      setInitialError(r.error);
      setConnected(r.connected);
    });
  }, []);

  const toggleLang = () => applyLang((i18n.language === "ar" ? "en" : "ar") as Lang);

  if (connected === null) return <div className="p-6 text-slate-500">…</div>;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <h1 className="text-lg font-semibold">{t("app.title")}</h1>
        <span className="text-xs text-slate-500">
          {t("app.machine")}: {machine}
        </span>
        <div className="ms-auto flex items-center gap-2">
          {connected && config && (
            <span className="text-xs text-emerald-700">
              {t("conn.connected")}{" "}
              <span dir="ltr">
                {config.host}/{config.database}
              </span>
            </span>
          )}
          {connected && (
            <Button variant="outline" onClick={() => setConnected(false)}>
              {t("conn.change")}
            </Button>
          )}
          <Button variant="outline" onClick={toggleLang}>
            {t("app.language")}
          </Button>
        </div>
      </header>

      {!connected ? (
        <ConnectionScreen
          initial={config}
          initialError={initialError}
          onConnected={(c) => {
            setConfig(c);
            setConnected(true);
          }}
        />
      ) : (
        <>
          <nav className="no-print flex gap-1 border-b border-slate-200 bg-white px-5">
            {(["lang", "sessions", "grid", "windows"] as Tab[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`border-b-2 px-4 py-2 text-sm ${
                  tab === k ? "border-sky-700 font-semibold text-sky-800" : "border-transparent text-slate-600"
                }`}
              >
                {t(`tabs.${k}`)}
              </button>
            ))}
          </nav>
          {/* Every tab stays mounted, so switching tabs or language never loses typed values. */}
          <main className="flex-1 p-5">
            <div hidden={tab !== "lang"}>
              <LangTab numberStyle={numberStyle} setNumberStyle={setNumberStyle} />
            </div>
            <div hidden={tab !== "sessions"}>
              <SessionsTab />
            </div>
            <div hidden={tab !== "grid"}>
              <GridTab numberStyle={numberStyle} />
            </div>
            <div hidden={tab !== "windows"}>
              <WindowsTab numberStyle={numberStyle} />
            </div>
          </main>
        </>
      )}
    </div>
  );
}
