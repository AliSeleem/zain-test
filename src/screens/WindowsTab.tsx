import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { api } from "../api";
import { formatAmount, formatInt, type NumberStyle } from "../numbers";
import { useMsg } from "../useMsg";
import { Button, Card, Notice } from "../ui";

const ITEMS = [
  { name: "سكر أبيض ١ كغ", qty: 12, price: 18500 },
  { name: "زيت زيتون ٢ ليتر", qty: 3, price: 125000 },
  { name: "Rice Basmati 5kg", qty: 5, price: 96000 },
];

export default function WindowsTab({ numberStyle }: { numberStyle: NumberStyle }) {
  const { t } = useTranslation();
  const msg = useMsg();
  const [error, setError] = useState<unknown>(null);
  const grand = ITEMS.reduce((s, i) => s + i.qty * i.price, 0);

  function openWindow() {
    // Each function opens in its own window (A16). Labels must be unique.
    new WebviewWindow(`win-${Date.now()}`, {
      url: "index.html#/second",
      title: t("windows.second_title"),
      width: 520,
      height: 360,
    });
  }

  async function quit() {
    setError(null);
    try {
      await api.requestQuit();
    } catch (e) {
      setError(e);
    }
  }

  async function print() {
    try {
      await api.printWindow();
    } catch {
      window.print();
    }
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Notice tone="info">{t("windows.intro")}</Notice>
      {error != null && <Notice tone="error">{msg(error)}</Notice>}
      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={openWindow}>{t("windows.open")}</Button>
        <Button variant="danger" onClick={quit}>
          {t("windows.quit")}
        </Button>
        <Button variant="outline" onClick={print}>
          {t("windows.print")}
        </Button>
      </div>
      <Card title={t("windows.invoice")}>
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 text-start">{t("windows.item")}</th>
              <th className="py-1 text-end">{t("windows.qty")}</th>
              <th className="py-1 text-end">{t("windows.price")}</th>
              <th className="py-1 text-end">{t("windows.total")}</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((i) => (
              <tr key={i.name} className="border-t border-slate-100">
                <td className="py-1">{i.name}</td>
                <td className="py-1 text-end">{formatInt(i.qty, numberStyle)}</td>
                <td className="py-1 text-end">{formatAmount(i.price, numberStyle)}</td>
                <td className="py-1 text-end">{formatAmount(i.qty * i.price, numberStyle)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td className="py-1" colSpan={3}>
                {t("windows.grand")}
              </td>
              <td className="py-1 text-end">{formatAmount(grand, numberStyle)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
