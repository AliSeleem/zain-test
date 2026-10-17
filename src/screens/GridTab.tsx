import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { api, type LedgerRow, type Stats } from "../api";
import { formatAmount, formatInt, type NumberStyle } from "../numbers";
import { useMsg } from "../useMsg";
import { Button, Notice } from "../ui";

const PAGE = 200;
const ROW_HEIGHT = 34;
const COLS = "grid-cols-[80px_110px_110px_1fr_1fr_140px_140px]";

export default function GridTab({ numberStyle }: { numberStyle: NumberStyle }) {
  const { t } = useTranslation();
  const msg = useMsg();
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Page cache: only pages near the visible rows are ever fetched.
  const pages = useRef(new Map<number, LedgerRow[]>());
  const loading = useRef(new Set<number>());
  const [, rerender] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const total = stats?.rows ?? 0;
  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });
  const items = virtualizer.getVirtualItems();

  function resetCache() {
    pages.current.clear();
    loading.current.clear();
  }

  async function run(action: () => Promise<Stats | void>) {
    setBusy(true);
    setError(null);
    try {
      const s = await action();
      resetCache();
      setStats(s ?? (await api.rowStats()));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api.rowStats().then(setStats).catch(setError);
  }, []);

  useEffect(() => {
    if (!items.length) return;
    const first = Math.floor(items[0].index / PAGE);
    const last = Math.floor(items[items.length - 1].index / PAGE);
    for (let p = first; p <= last; p++) {
      if (pages.current.has(p) || loading.current.has(p)) continue;
      loading.current.add(p);
      api
        .fetchRows(p * PAGE, PAGE)
        .then((rows) => {
          pages.current.set(p, rows);
          rerender((n) => n + 1);
        })
        .finally(() => loading.current.delete(p));
    }
  }, [items]);

  const rowAt = (i: number) => pages.current.get(Math.floor(i / PAGE))?.[i % PAGE];

  return (
    <div className="grid gap-3">
      <Notice tone="info">{t("grid.intro")}</Notice>
      {error != null && <Notice tone="error">{msg(error)}</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy} onClick={() => run(() => api.seedRows(100_000))}>
          {t("grid.seed", { n: formatInt(100_000, numberStyle) })}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run(() => api.seedRows(1_000_000))}>
          {t("grid.seed", { n: formatInt(1_000_000, numberStyle) })}
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => run(() => api.clearRows())}>
          {t("grid.clear")}
        </Button>
        <span className="ms-2 text-sm text-slate-600">
          {busy
            ? t("grid.working")
            : stats &&
              t("grid.stats", {
                rows: formatInt(stats.rows, numberStyle),
                debit: formatAmount(stats.total_debit, numberStyle),
                credit: formatAmount(stats.total_credit, numberStyle),
                ms: stats.millis,
              })}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <div className={`grid ${COLS} gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-600`}>
          <div>{t("grid.col_id")}</div>
          <div>{t("grid.col_date")}</div>
          <div>{t("grid.col_code")}</div>
          <div>{t("grid.col_name")}</div>
          <div>{t("grid.col_desc")}</div>
          <div className="text-end">{t("grid.col_debit")}</div>
          <div className="text-end">{t("grid.col_credit")}</div>
        </div>
        <div ref={scrollRef} className="h-[480px] overflow-auto">
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {items.map((v) => {
              const r = rowAt(v.index);
              return (
                <div
                  key={v.key}
                  className={`absolute start-0 end-0 grid ${COLS} items-center gap-2 border-b border-slate-100 px-3`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${v.start}px)` }}
                >
                  {r ? (
                    <>
                      <div>{formatInt(r.id, numberStyle)}</div>
                      <div dir="ltr" className="text-start">
                        {r.entry_date}
                      </div>
                      <div>{r.account_code}</div>
                      <div>{r.account_name}</div>
                      <div className="truncate">{r.description}</div>
                      <div className="text-end tabular-nums">{formatAmount(r.debit, numberStyle)}</div>
                      <div className="text-end tabular-nums">{formatAmount(r.credit, numberStyle)}</div>
                    </>
                  ) : (
                    <div className="col-span-7 h-3 w-1/2 rounded bg-slate-100" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
