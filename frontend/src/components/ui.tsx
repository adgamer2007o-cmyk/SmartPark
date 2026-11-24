import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-primary text-white hover:bg-primary-dark",
    secondary: "bg-white text-ink border border-gray-200 hover:bg-gray-50",
    ghost: "bg-transparent text-primary hover:bg-blue-50",
    danger: "bg-danger text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const inputId = id || props.name || label;
  return (
    <label className="block text-sm" htmlFor={inputId}>
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        id={inputId}
        className="min-h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-ink shadow-sm focus:border-primary"
        {...props}
      />
      {error ? <span className="mt-1 block text-danger">{error}</span> : null}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.1)] ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "green" | "amber" | "red" | "blue" }) {
  const map = {
    gray: "bg-gray-100 text-muted",
    green: "bg-green-100 text-success",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-danger",
    blue: "bg-blue-100 text-primary",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

export function FieldSelect({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select className="min-h-11 w-full rounded-md border border-gray-200 bg-white px-3" {...props}>
        {children}
      </select>
    </label>
  );
}
