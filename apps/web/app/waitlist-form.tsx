"use client";

import { useRef, useState, type FormEvent } from "react";
import { BRAND } from "@app/core";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

type State = "idle" | "sending" | "success" | "invalid" | "rate_limited" | "server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v);

const MESSAGES = {
  invalid: "Enter a valid email address, like name@example.com.",
  rate_limited: "Too many tries. Please wait a few minutes and try again.",
  server: "Something went wrong on our side. Your email was not saved. Please try again.",
} as const;

export function WaitlistForm() {
  const [state, setState] = useState<State>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const sending = state === "sending";
  const invalid = state === "invalid";

  function checkEmail() {
    const ok = isEmail(inputRef.current?.value.trim() ?? "");
    if (!ok) setState("invalid");
    return ok;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    if (!checkEmail()) {
      inputRef.current?.focus();
      return;
    }
    const data = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? "").trim(),
          website: String(data.get("website") ?? ""),
          source: "landing",
        }),
      });
      if (res.ok) setState("success");
      else if (res.status === 400) {
        setState("invalid");
        inputRef.current?.focus();
      } else setState(res.status === 429 ? "rate_limited" : "server");
    } catch {
      setState("server");
    }
  }

  const error = state === "rate_limited" || state === "server" || invalid;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={sending} className="w-full max-w-prose">
      <Label htmlFor="waitlist-email">Email address</Label>
      <div className="mt-1 flex flex-col gap-3 md:flex-row">
        <Input
          ref={inputRef}
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          readOnly={sending}
          aria-invalid={invalid}
          aria-describedby="waitlist-help waitlist-status"
          onBlur={(e) => e.currentTarget.value && checkEmail()}
          className="md:flex-1"
        />
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="waitlist-website">Website</label>
          <input id="waitlist-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Button type="submit" disabled={sending} className="md:w-40">
          {sending ? (
            <>
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              Sending...
            </>
          ) : (
            "Join the waitlist"
          )}
        </Button>
      </div>
      <p id="waitlist-help" className="mt-2 text-sm text-muted-foreground">
        One email when we open. No spam. No bank linking.
      </p>
      <div id="waitlist-status" aria-live="polite" className="mt-3">
        {state === "success" && (
          <p className="fade-in flex items-start gap-2 rounded-lg border border-success-fg p-3 text-sm text-success-fg">
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Thanks. If this address is new, we will email you when {BRAND} opens.
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {MESSAGES[state as keyof typeof MESSAGES]}
          </p>
        )}
      </div>
    </form>
  );
}
