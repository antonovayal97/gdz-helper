"use client";

import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border border-border bg-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardAction({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-center gap-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 mt-2 px-1 text-sm font-semibold uppercase tracking-wide text-hint">
      {children}
    </h2>
  );
}
