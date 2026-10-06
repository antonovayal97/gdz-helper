"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link/40";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground shadow-sm hover:opacity-90",
  secondary: "bg-card text-foreground hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-card",
  destructive: "bg-destructive text-white hover:opacity-90",
  outline: "border border-border bg-transparent text-foreground hover:bg-card",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3.5 py-2",
  md: "text-[15px] px-4 py-2.5",
  lg: "text-base px-5 py-3.5",
  xl: "text-lg px-6 py-5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : leftIcon}
      {children}
    </button>
  );
}
