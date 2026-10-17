import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type DbConfig } from "../api";
import { useMsg } from "../useMsg";
import { Button, Card, Field, Notice } from "../ui";

const DEFAULTS: DbConfig = { host: "127.0.0.1", port: 5432, database: "zain_spike", username: "postgres", password: "" };

export default function ConnectionScreen({
  initial,
  initialError,
  onConnected,
}: {
  initial: DbConfig | null;
  initialError: unknown;
  onConnected: (c: DbConfig) => void;
}) {
  const { t } = useTranslation();
  const msg = useMsg();
  const [cfg, setCfg] = useState<DbConfig>(initial ?? DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(initialError);

  const set = (k: keyof DbConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg({ ...cfg, [k]: k === "port" ? Number(e.target.value) : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.connectAndSave(cfg);
      onConnected(cfg);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-lg p-4">
      <Card title={t("conn.title")}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Notice tone="info">{t("conn.hint")}</Notice>
          {error != null && <Notice tone="error">{msg(error)}</Notice>}
          <Field label={t("conn.host")} value={cfg.host} onChange={set("host")} dir="ltr" autoFocus />
          <Field label={t("conn.port")} value={cfg.port} onChange={set("port")} dir="ltr" type="number" />
          <Field label={t("conn.database")} value={cfg.database} onChange={set("database")} dir="ltr" />
          <Field label={t("conn.username")} value={cfg.username} onChange={set("username")} dir="ltr" />
          <Field label={t("conn.password")} value={cfg.password} onChange={set("password")} dir="ltr" type="password" />
          <Button type="submit" disabled={busy}>
            {busy ? t("conn.connecting") : t("conn.connect")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
