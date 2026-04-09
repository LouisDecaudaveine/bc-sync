"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-6 gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge && <span className="text-xs text-neutral-500">{badge}</span>}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Minify" : "Expand"}
          className="rounded border border-neutral-700 w-7 h-7 leading-none text-base text-neutral-300 hover:bg-neutral-800"
        >
          {open ? "−" : "+"}
        </button>
      </div>
      {open && children}
    </section>
  );
}
