"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, History, Wallet } from "lucide-react";

const items = [
  { href: "/", label: "Решить", icon: Camera },
  { href: "/history", label: "История", icon: History },
  { href: "/balance", label: "Баланс", icon: Wallet },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    // NOTE: the row must use min-h (not h) because it is border-box: a fixed
    // h-[64px] minus a ~34px safe-area padding would crush the icons into a
    // ~30px strip (the "flattened" look on iPhone). min-h keeps the content
    // row at least 64px and lets the bar grow by the inset instead.
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex min-h-[64px] max-w-md items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className="flex min-w-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "text-hint"
                }`}
              >
                <it.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span
                className={`text-[11px] font-medium leading-none ${
                  active ? "text-accent" : "text-hint"
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
