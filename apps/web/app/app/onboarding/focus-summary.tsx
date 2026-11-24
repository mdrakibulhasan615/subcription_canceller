"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Error summary box. Takes focus when it appears, so screen readers read it. */
export function FocusSummary({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mt-6 max-w-prose rounded-lg border border-destructive p-4 text-destructive"
    >
      {children}
    </div>
  );
}
