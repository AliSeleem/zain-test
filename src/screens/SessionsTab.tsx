import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Session } from "../api";
import { useMsg } from "../useMsg";
import { Button, Card, Field, Notice } from "../ui";

const HEARTBEAT_MS = 10_000;
const REFRESH_MS = 3_000;

export default function SessionsTab() {
  const { t } = useTranslation();
  const msg = useMsg();
  const [username, setUsername] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [copies, setCopies] = useState(3);
  const [copiesInput, setCopiesInput] = useState("3");
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api.listSessions();
      setSessions(r.sessions);
      setCopies(r.copies);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    api.listSessions().then((r) => setCopiesInput(String(r.copies)));
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // A session that stops sending heartbeats (crash, power cut) is freed by the next login.
  useEffect(() => {
    if (sessionId == null) return;
    const id = setInterval(() => api.heartbeat(sessionId), HEARTBEAT_MS);
    const release = () => void api.logout(sessionId);
    window.addEventListener("beforeunload", release);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", release);
    };
  }, [sessionId]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setSessionId(await api.login(username));
      refresh();
    } catch (err) {
      setError(err);
    }
  }

  async function logout() {
    if (sessionId == null) return;
    await api.logout(sessionId);
    setSessionId(null);
    refresh();
  }

  async function saveCopies() {
    await api.setCopies(Number(copiesInput));
    refresh();
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Notice tone="info">{t("sessions.intro")}</Notice>
      {error != null && <Notice tone="error">{msg(error)}</Notice>}
      <Card>
        {sessionId == null ? (
          <form onSubmit={login} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label={t("sessions.username")} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <Button type="submit">{t("sessions.login")}</Button>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <Notice tone="ok">{t("sessions.you", { id: sessionId })}</Notice>
            <Button variant="outline" onClick={logout}>
              {t("sessions.logout")}
            </Button>
          </div>
        )}
      </Card>
      <Card title={t("sessions.active", { n: sessions.length, copies })}>
        <div className="mb-4 flex items-end gap-3">
          <div className="w-40">
            <Field
              label={t("sessions.copies")}
              type="number"
              min={1}
              value={copiesInput}
              onChange={(e) => setCopiesInput(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={saveCopies}>
            {t("sessions.save")}
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-start">#</th>
              <th className="py-1 text-start">{t("sessions.col_user")}</th>
              <th className="py-1 text-start">{t("sessions.col_machine")}</th>
              <th className="py-1 text-start">{t("sessions.col_started")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className={`border-t border-slate-100 ${s.id === sessionId ? "bg-emerald-50" : ""}`}>
                <td className="py-1">{s.id}</td>
                <td className="py-1">{s.username}</td>
                <td className="py-1">{s.machine}</td>
                <td className="py-1" dir="ltr">
                  {s.started_at}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
