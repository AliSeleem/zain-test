import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatAmount, type NumberStyle } from "../numbers";
import { Button, Card, Field, Notice } from "../ui";

export default function LangTab({
  numberStyle,
  setNumberStyle,
}: {
  numberStyle: NumberStyle;
  setNumberStyle: (s: NumberStyle) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="grid max-w-3xl gap-4">
      <Notice tone="info">{t("lang.intro")}</Notice>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("lang.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <Field label={t("lang.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>
      <Card title={t("lang.numbers")}>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={numberStyle === "latn" ? "primary" : "outline"} onClick={() => setNumberStyle("latn")}>
            {t("lang.latn")}
          </Button>
          <Button variant={numberStyle === "arab" ? "primary" : "outline"} onClick={() => setNumberStyle("arab")}>
            {t("lang.arab")}
          </Button>
          <span className="ms-4 text-sm">
            {t("lang.sample")}: <b>{formatAmount(1234567.5, numberStyle)}</b>
          </span>
        </div>
      </Card>
    </div>
  );
}
