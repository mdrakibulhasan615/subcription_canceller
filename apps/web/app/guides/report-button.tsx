"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";

type State = "idle" | "sending" | "success" | "invalid" | "rate_limited" | "server";

const MESSAGES = {
  invalid: "Write 5 to 500 characters.",
  rate_limited: "Too many tries. Please wait a few minutes and try again.",
  server: "Something went wrong on our side. Your report was not saved. Please try again.",
} as const;

export function ReportButton({ kind, slug }: { kind: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const sending = state === "sending";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    const message = String(data.get("message") ?? "").trim();
    if (message.length < 5 || message.length > 500) {
      setState("invalid");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/guide-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, slug, message, website: String(data.get("website") ?? "") }),
      });
      if (res.ok) setState("success");
      else if (res.status === 400) setState("invalid");
      else setState(res.status === 429 ? "rate_limited" : "server");
    } catch {
      setState("server");
    }
  }

  const error = state === "invalid" || state === "rate_limited" || state === "server";

  return (
    <div className="mt-2 max-w-prose">
      {!open && state !== "success" && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Report a problem
        </Button>
      )}
      {open && state !== "success" && (
        <form onSubmit={onSubmit} noValidate aria-busy={sending}>
          <Label htmlFor="report-message">What is wrong with this guide?</Label>
          <textarea
            id="report-message"
            name="message"
            rows={4}
            maxLength={500}
            readOnly={sending}
            aria-invalid={state === "invalid"}
            aria-describedby="report-help report-status"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
          />
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="report-website">Website</label>
            <input id="report-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <p id="report-help" className="mt-1 text-sm text-muted-foreground">
            Up to 500 characters. We store only this text. No email or account details.
          </p>
          <Button type="submit" disabled={sending} className="mt-3">
            {sending ? (
              <>
                <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              "Send report"
            )}
          </Button>
        </form>
      )}
      <div id="report-status" aria-live="polite" className="mt-3">
        {state === "success" && (
          <p className="flex items-start gap-2 rounded-lg border border-success-fg p-3 text-sm text-success-fg">
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Thanks. We will check this guide.
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {MESSAGES[state as keyof typeof MESSAGES]}
          </p>
        )}
      </div>
    </div>
  );
}
