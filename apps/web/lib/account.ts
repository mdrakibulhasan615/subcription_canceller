export const RECENT_SESSION_SEC = 15 * 60;

export type DeleteCode = "auth" | "confirm" | "rate" | "recent" | "no_email" | "server";
export type DeleteResult =
  { status: "ok" } | { status: "error"; code: DeleteCode; message: string };

export type DeleteDeps = {
  /** From verified claims. authTime is the last sign-in time in seconds (max amr timestamp). */
  getUser(): { id: string; email: string | null; authTime?: number } | null;
  admin: {
    deleteWaitlistByEmail(email: string): Promise<{ error: unknown }>;
    deleteUser(id: string): Promise<{ error: { message?: string; code?: string } | null }>;
  };
  signOut(): Promise<unknown>;
  rateLimit(key: string): { ok: boolean; retryAfterSec: number };
  now?: () => number;
};

const fail = (code: DeleteCode, message: string): DeleteResult => ({
  status: "error",
  code,
  message,
});

function isNotFound(e: { message?: string; code?: string }) {
  return e.code === "user_not_found" || /user not found/i.test(e.message ?? "");
}

export async function deleteAccount(
  deps: DeleteDeps,
  form: { confirm: string; email: string },
): Promise<DeleteResult> {
  const user = deps.getUser();
  if (!user) return fail("auth", "Sign in to delete your account.");

  const limit = deps.rateLimit(`delete:${user.id}`);
  if (!limit.ok) {
    const min = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return fail("rate", `Too many tries. Wait ${min} minute${min === 1 ? "" : "s"} and try again.`);
  }

  const email = user.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return fail("no_email", "Your account has no email. Contact us to delete it.");
  }
  if (form.confirm !== "DELETE" || form.email.trim().toLowerCase() !== email) {
    return fail("confirm", "Type DELETE in capital letters and your account email to confirm.");
  }

  const nowSec = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  if (typeof user.authTime !== "number" || nowSec - user.authTime > RECENT_SESSION_SEC) {
    return fail("recent", "Sign in again, then retry.");
  }

  try {
    const w = await deps.admin.deleteWaitlistByEmail(email);
    if (w.error) return fail("server", "Something went wrong. Nothing was deleted. Try again.");
    const { error } = await deps.admin.deleteUser(user.id);
    if (error && !isNotFound(error)) {
      return fail("server", "Something went wrong. Your account may not be deleted. Try again.");
    }
  } catch {
    return fail("server", "Something went wrong. Your account may not be deleted. Try again.");
  }

  try {
    await deps.signOut();
  } catch {
    // The user is gone. A failed sign-out only leaves a dead cookie.
  }
  return { status: "ok" };
}

/** Last sign-in time (seconds) from the amr claim. iat is the token refresh time: not usable. */
export function authTimeFromAmr(amr: unknown): number | undefined {
  if (!Array.isArray(amr)) return undefined;
  const ts = amr.flatMap((e) =>
    typeof e === "object" && e !== null && typeof e.timestamp === "number" ? [e.timestamp] : [],
  );
  return ts.length ? Math.max(...ts) : undefined;
}
