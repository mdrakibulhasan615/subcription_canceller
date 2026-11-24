export const DEFAULT_AFTER_SIGN_IN = "/app";

const MAX_LEN = 200;
// Control chars, space, DEL, backslash.
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000- \u007f-\u009f\\]/;

function isAppPath(p: string) {
  return p === "/app" || /^\/app[/?#]/.test(p);
}

/** Returns raw only if it is a same-origin /app path. Otherwise "/app". */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LEN) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw); // decode once
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
  const ok =
    !raw.startsWith("//") &&
    !decoded.startsWith("//") &&
    !BAD_CHARS.test(raw) &&
    !BAD_CHARS.test(decoded) &&
    isAppPath(raw) &&
    isAppPath(decoded);
  return ok ? raw : DEFAULT_AFTER_SIGN_IN;
}

export type RouteDecision = { type: "next" } | { type: "redirect"; to: string };

export function routeDecision(pathname: string, search: string, isAuthed: boolean): RouteDecision {
  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (isAuthed) return { type: "next" };
    const next = encodeURIComponent(safeNext(pathname + search));
    return { type: "redirect", to: `/sign-in?next=${next}` };
  }
  if (pathname === "/sign-in" && isAuthed) {
    return { type: "redirect", to: DEFAULT_AFTER_SIGN_IN };
  }
  return { type: "next" };
}
