// Minimal shadcn-style primitives for the spike. The real app adds them with the
// shadcn CLI. Only logical Tailwind classes (ms-, pe-, start-, text-start) are used,
// so every component works in RTL and LTR unchanged.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" }) {
  const styles = {
    primary: "bg-sky-700 text-white hover:bg-sky-800",
    outline: "border border-slate-300 bg-white hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  }[variant];
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-start outline-none focus:border-sky-600"
        {...props}
      />
    </label>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-rose-300 bg-rose-50 text-rose-800",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];
  return <div className={`rounded-md border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
