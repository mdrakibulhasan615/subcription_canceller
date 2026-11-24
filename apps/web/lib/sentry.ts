import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const EMAIL_RE = /[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+\.[^\s@<>()[\]",;:]+/g;
const NUMBER_RE = /\d(?:[ .-]{0,2}\d){12,18}/g;

export function scrubString(s: string): string {
  // NFKC turns full-width digits and "@" into ASCII before matching.
  return s.normalize("NFKC").replace(EMAIL_RE, "[email]").replace(NUMBER_RE, "[number]");
}

function scrubValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return scrubString(v);
  if (depth > 5) return "[deep]";
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrubValue(x, depth + 1)]));
}

function pathOnly(url: string): string {
  let p: string;
  try {
    p = new URL(url, "http://x").pathname;
  } catch {
    p = url.split(/[?#]/)[0] ?? "";
  }
  return scrubString(decodeURIComponent_(p));
}

function decodeURIComponent_(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

// Returns null on any failure: never send an event we could not scrub.
export function scrubEvent<T extends ErrorEvent>(event: T): T | null {
  try {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
      if (event.request.url) event.request.url = pathOnly(event.request.url);
    }
    delete event.user;
    if (event.transaction) event.transaction = scrubString(event.transaction);
    for (const k of ["extra", "contexts", "tags"] as const) {
      if (event[k]) event[k] = scrubValue(event[k]) as never;
    }
    if (event.message) event.message = scrubString(event.message);
    for (const ex of event.exception?.values ?? []) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs
        .map((b) => beforeBreadcrumb(b))
        .filter((b): b is Breadcrumb => b !== null);
    }
    return event;
  } catch {
    return null;
  }
}

export function beforeBreadcrumb(b: Breadcrumb): Breadcrumb | null {
  try {
    if (b.category === "console") return null;
    if (b.category === "fetch" || b.category === "xhr") {
      // Keep method and path only: bodies and query strings can hold personal data.
      const url = typeof b.data?.url === "string" ? pathOnly(b.data.url) : undefined;
      return { ...b, data: { method: b.data?.method, url } };
    }
    if (b.message) b.message = scrubString(b.message);
    if (b.data) b.data = scrubValue(b.data) as Breadcrumb["data"];
    return b;
  } catch {
    return null;
  }
}

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: 0,
  sampleRate: 1,
  beforeSend: scrubEvent,
  beforeBreadcrumb,
};
