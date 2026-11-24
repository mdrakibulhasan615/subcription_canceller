import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  SignInForm,
  callbackUrl,
  isEmail,
  mapAuthError,
  sendLink,
  startGoogle,
} from "./sign-in-form";

const fake = (over: object = {}) => {
  const auth = {
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
    ...over,
  };
  return { auth } as never as Parameters<typeof sendLink>[0] & { auth: typeof auth };
};
const url = "http://localhost:3000/auth/callback?next=%2Fapp";

describe("sign-in form", () => {
  it("11. rejects bad emails; markup has label, aria-invalid slot, live region", () => {
    for (const v of ["", "a", "a@b", "a b@c.d", "@x.com"]) expect(isEmail(v), v).toBe(false);
    expect(isEmail("name@example.com")).toBe(true);
    const html = renderToStaticMarkup(
      createElement(SignInForm, { next: "/app", callbackError: false }),
    );
    expect(html).toMatch(/<label[^>]*for="signin-email"/);
    expect(html).toMatch(/<input[^>]*id="signin-email"[^>]*aria-invalid="false"/);
    expect(html).toContain('role="status"');
    expect(html).toContain("Sign in to ");
    expect(html).toContain("Send sign-in link");
    expect(html).toContain("Continue with Google");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });

  it("12. valid email calls signInWithOtp once with the callback url", async () => {
    const c = fake();
    expect(callbackUrl("http://localhost:3000", "/app")).toBe(url);
    expect(callbackUrl("http://localhost:3000", "//evil.com")).toBe(url);
    expect(await sendLink(c, "a@b.co", url)).toBe("ok");
    expect(c.auth.signInWithOtp).toHaveBeenCalledOnce();
    expect(c.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@b.co",
      options: { emailRedirectTo: url, shouldCreateUser: true },
    });
  });

  it("13. 429 maps to rate_limited, other errors to server", async () => {
    expect(mapAuthError({ status: 429 })).toBe("rate_limited");
    expect(mapAuthError({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(mapAuthError({ status: 500 })).toBe("server");
    expect(
      await sendLink(
        fake({ signInWithOtp: async () => ({ error: { status: 429 } }) }),
        "a@b.co",
        url,
      ),
    ).toBe("rate_limited");
    expect(
      await sendLink(
        fake({ signInWithOtp: async () => ({ error: { status: 500 } }) }),
        "a@b.co",
        url,
      ),
    ).toBe("server");
    expect(
      await sendLink(
        fake({
          signInWithOtp: async () => {
            throw new Error("net");
          },
        }),
        "a@b.co",
        url,
      ),
    ).toBe("server");
  });

  it("14. Google calls signInWithOAuth with the same redirectTo", async () => {
    const c = fake();
    expect(await startGoogle(c, url)).toBe(true);
    expect(c.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: url },
    });
    expect(await startGoogle(fake({ signInWithOAuth: async () => ({ error: {} }) }), url)).toBe(
      false,
    );
  });

  it("15. ?error=callback shows the alert", () => {
    const html = renderToStaticMarkup(
      createElement(SignInForm, { next: "/app", callbackError: true }),
    );
    expect(html).toContain("That link did not work.");
    expect(html).toContain('role="alert"');
  });
});
