"use client";

import { useEffect, useRef } from "react";
import { CircleAlert } from "lucide-react";

/** Focusable error summary. Gets focus when it appears. */
export function ErrorSummary({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      id="step-error"
      tabIndex={-1}
      role="alert"
      className="mt-4 flex max-w-prose items-start gap-2 rounded-lg border border-destructive p-4 text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}
