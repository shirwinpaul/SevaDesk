"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function PageHeader({ title, icon, actions }: { title: string; icon?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h1 className="text-2xl font-bold">
        {icon && <span aria-hidden="true">{icon} </span>}
        {title}
      </h1>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Field({ label, help, children, htmlFor }: { label: string; help?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block font-medium">
        {label}
      </label>
      {children}
      {help && <p className="text-sm muted">{help}</p>}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string };
export function TextInput({ label, help, ...rest }: InputProps) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <input id={id} className="field" {...rest} />
    </Field>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; help?: string };
export function TextArea({ label, help, ...rest }: AreaProps) {
  const id = useId();
  return (
    <Field label={label} help={help} htmlFor={id}>
      <textarea id={id} className="field" {...rest} />
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};
export function Select({ label, options, ...rest }: SelectProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} className="field" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 min-h-[48px] cursor-pointer">
      <input
        type="checkbox"
        className="w-6 h-6 shrink-0 accent-teal-700"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** Live region so screen readers hear saves and AI results. */
export function LiveMessage({ message, tone = "info" }: { message: string; tone?: "info" | "error" | "success" }) {
  const color =
    tone === "error"
      ? "bg-red-50 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100"
      : tone === "success"
        ? "bg-leaf-100 text-leaf-700 border-leaf-600 dark:bg-green-950 dark:text-green-100"
        : "bg-teal-50 text-teal-800 border-teal-600 dark:bg-teal-800 dark:text-white";
  return (
    <div aria-live="polite" role={tone === "error" ? "alert" : "status"}>
      {message && <p className={`rounded-xl border px-3 py-2 ${color}`}>{message}</p>}
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="card w-full max-w-xl max-h-[90dvh] overflow-y-auto space-y-4"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="card text-center space-y-3 py-8">
      <p className="muted">{text}</p>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-8">
      <span className="inline-block w-6 h-6 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card text-center min-w-0">
      <div className="text-2xl font-bold text-teal-700 dark:text-teal-100 [overflow-wrap:anywhere]">{value}</div>
      <div className="text-sm muted [overflow-wrap:anywhere]">{label}</div>
    </div>
  );
}

/** Copy text to clipboard; returns false if the browser refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Trigger a client-side file download. */
export function downloadFile(name: string, content: string | Blob, type = "text/plain"): void {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print only the element(s) marked `.print-target` (see globals.css). */
export function printScoped(): void {
  document.body.classList.add("print-scope");
  const done = () => {
    document.body.classList.remove("print-scope");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
