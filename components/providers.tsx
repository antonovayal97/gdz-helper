"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-context";
import { ToastProvider } from "./toast-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
