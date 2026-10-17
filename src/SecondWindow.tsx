import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button, Card } from "./ui";

export default function SecondWindow() {
  const { t } = useTranslation();
  return (
    <div className="p-6">
      <Card title={t("windows.second_title")}>
        <p className="mb-4 text-sm text-slate-600">{t("windows.second_body")}</p>
        <Button variant="outline" onClick={() => getCurrentWindow().close()}>
          ✕
        </Button>
      </Card>
    </div>
  );
}
