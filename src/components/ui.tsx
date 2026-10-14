// Petits composants d'interface : grands boutons, fort contraste
import type { ButtonHTMLAttributes, ReactNode } from "react";

const BASE =
  "min-h-14 px-6 rounded-xl border-2 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition";
const VARIANTS = {
  primary: "bg-blue-800 border-blue-950 text-white hover:bg-blue-900",
  secondary: "bg-white border-slate-900 text-slate-900 hover:bg-slate-100",
  danger: "bg-red-700 border-red-950 text-white hover:bg-red-800",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return <button {...props} className={`${BASE} ${VARIANTS[variant]} ${className}`} />;
}

export const inputClass =
  "w-full min-h-14 px-4 rounded-xl border-2 border-slate-900 bg-white text-xl";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border-2 border-slate-900 bg-white p-5 ${className}`}>
      {children}
    </section>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-extrabold mb-4">{children}</h1>;
}

export function Notice({
  kind,
  children,
}: {
  kind: "error" | "ok" | "info";
  children: ReactNode;
}) {
  const colors = {
    error: "bg-red-100 border-red-800 text-red-950",
    ok: "bg-green-100 border-green-800 text-green-950",
    info: "bg-yellow-100 border-yellow-800 text-yellow-950",
  };
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border-2 p-4 text-lg font-semibold ${colors[kind]}`}>
      {children}
    </p>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-lg font-bold mb-1">{label}</span>
      {children}
    </label>
  );
}
