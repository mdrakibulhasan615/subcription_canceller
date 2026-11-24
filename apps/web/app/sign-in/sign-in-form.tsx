"use client";

import { useRef, useState, type FormEvent } from "react";
import { BRAND } from "@app/core";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { safeNext } from "../../lib/auth-routes";
import { createClient } from "../../lib/supabase/browser";

type State = "idle" | "sending" | "sent" | "invalid" | "rate_limited" | "server";
type AuthClient = { auth: ReturnType<typeof createClient>["auth"] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v);

export function mapAuthError(error: { status?: number; code?: string }): "rate_limited" | "server" {
  const limited =
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit";
  return limited ? "rate_limited" : "server";
}

export function callbackUrl(origin: string, next: unknown) {
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

export async function sendLink(
  client: AuthClient,
  email: string,
  redirectTo: string,
): Promise<"ok" | "rate_limited" | "server"> {
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    return error ? mapAuthError(error) : "ok";
  } catch {
    return "server";
  }
}

/** Returns false if Google sign-in did not start. */
export async function startGoogle(client: AuthClient, redirectTo: string): Promise<boolean> {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return !error;
  } catch {
    return false;
  }
}

const MESSAGES = {
  invalid: "Enter a valid email address, like name@example.com.",
  rate_limited: "Too many tries. Please wait a few minutes and try again.",
  server: "Something went wrong on our side. Your email was not sent. Please try again.",
} as const;
const CALLBACK_ERROR =
  "That link did not work. It may have expired or been used already. Send a new link.";
const GOOGLE_ERROR = "Google sign-in did not start. Try again or use an email link.";

export function SignInForm({ next, callbackError }: { next: string; callbackError: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [sentTo, setSentTo] = useState("");
  const [googleError, setGoogleError] = useState(false);
  const [again, setAgain] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sending = state === "sending";
  const invalid = state === "invalid";
  const fieldError = invalid || state === "rate_limited" || state === "server";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const email = inputRef.current?.value.trim() ?? "";
    if (!isEmail(email)) {
      setState("invalid");
      inputRef.current?.focus();
      return;
    }
    setGoogleError(false);
    setState("sending");
    let result: Awaited<ReturnType<typeof sendLink>>;
    try {
      result = await sendLink(createClient(), email, callbackUrl(location.origin, next));
    } catch {
      result = "server"; // env missing
    }
    if (result === "ok") {
      setSentTo(email);
      setState("sent");
    } else setState(result);
  }

  async function onGoogle() {
    setGoogleError(false);
    let ok = false;
    try {
      ok = await startGoogle(createClient(), callbackUrl(location.origin, next));
    } catch {
      // env missing
    }
    if (!ok) setGoogleError(true);
  }

  return (
    <>
      <a
        href="#main"
        className="absolute -top-20 left-4 z-100 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:top-4"
      >
        Skip to main content
      </a>
      <header className="mx-auto max-w-5xl px-4 py-4 md:px-6 lg:px-8">
        <span className="text-lg font-semibold">{BRAND}</span>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-24 lg:px-8">
        <div className="max-w-md">
          <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
            Sign in to {BRAND}
          </h1>
          <p className="mt-4 text-lg leading-7 text-muted-foreground">
            We email you a link. No password.
          </p>
          {callbackError && (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg border border-destructive p-3 text-sm text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {CALLBACK_ERROR}
            </p>
          )}
          <div role="status" className="mt-6">
            {state === "sent" && (
              <div className="fade-in rounded-lg border border-success-fg p-4 text-sm text-success-fg">
                <p className="font-medium">Check your email.</p>
                <p className="mt-1">
                  We sent a sign-in link to <span className="break-all">{sentTo}</span>. Open the
                  link on this device. It works once and expires in 1 hour. Check spam if you do not
                  see it.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3"
                  onClick={() => {
                    setAgain(true);
                    setState("idle");
                  }}
                >
                  Use a different email
                </Button>
              </div>
            )}
          </div>
          {state !== "sent" && (
            <>
              <form onSubmit={onSubmit} noValidate aria-busy={sending} className="mt-2">
                <Label htmlFor="signin-email">Email address</Label>
                <Input
                  ref={inputRef}
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus={again}
                  readOnly={sending}
                  aria-invalid={invalid}
                  aria-describedby={fieldError ? "signin-error" : undefined}
                  className="mt-1"
                />
                {fieldError && (
                  <p
                    id="signin-error"
                    className="mt-2 flex items-start gap-2 text-sm text-destructive"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {MESSAGES[state as keyof typeof MESSAGES]}
                  </p>
                )}
                <Button type="submit" disabled={sending} className="mt-4 w-full">
                  {sending ? (
                    <>
                      <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    "Send sign-in link"
                  )}
                </Button>
              </form>
              <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                or
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
                Continue with Google
              </Button>
              {googleError && (
                <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {GOOGLE_ERROR}
                </p>
              )}
            </>
          )}
          <p className="mt-6 text-sm text-muted-foreground">
            No bank linking. We never store card numbers.
          </p>
        </div>
      </main>
    </>
  );
}
