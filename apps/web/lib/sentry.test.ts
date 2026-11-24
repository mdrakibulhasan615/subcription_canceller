import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { beforeBreadcrumb, scrubEvent, scrubString, sentryOptions } from "./sentry";

describe("scrubString", () => {
  it("replaces emails and card-like numbers", () => {
    expect(scrubString("mail a.b+c@x.co now")).toBe("mail [email] now");
    expect(scrubString("card 4111 1111 1111 1111 end")).toBe("card [number] end");
    expect(scrubString("4111-1111-1111-1111")).toBe("[number]");
    expect(scrubString("4111111111111111")).toBe("[number]");
    expect(scrubString("order 12345")).toBe("order 12345");
  });
});

describe("scrubEvent", () => {
  it("removes request data, user and personal strings", () => {
    const e = {
      type: undefined,
      message: "fail for bob@x.com",
      user: { id: "1", email: "bob@x.com" },
      request: {
        url: "https://app.test/app/subs?token=abc",
        data: { card: "4111111111111111" },
        cookies: { a: "b" },
        headers: { cookie: "x" },
        query_string: "token=abc",
      },
      exception: { values: [{ value: "bad 4111 1111 1111 1111 for a@b.co" }] },
      breadcrumbs: [
        { category: "console", message: "x" },
        { category: "fetch", data: { url: "https://a.test/api?e=a@b.co", body: "secret" } },
        { category: "ui", message: "click a@b.co", data: { x: "4111111111111111" } },
      ],
    } as unknown as ErrorEvent;
    const out = scrubEvent(e)!;
    expect(out.user).toBeUndefined();
    expect(out.message).toBe("fail for [email]");
    expect(out.request).toEqual({ url: "/app/subs" });
    expect(out.exception?.values?.[0]?.value).toBe("bad [number] for [email]");
    expect(out.breadcrumbs).toHaveLength(2);
    expect(out.breadcrumbs?.[0]?.data).toEqual({ method: undefined, url: "/api" });
    expect(out.breadcrumbs?.[1]).toMatchObject({
      message: "click [email]",
      data: { x: "[number]" },
    });
  });

  it("handles odd shapes without throwing", () => {
    expect(scrubEvent({} as ErrorEvent)).toEqual({});
    expect(scrubEvent({ exception: { values: [{}] }, request: {} } as ErrorEvent)).not.toBeNull();
    expect(scrubEvent(null as unknown as ErrorEvent)).toBeNull();
    expect(beforeBreadcrumb(null as never)).toBeNull();
  });
});

describe("sentryOptions", () => {
  it("is private by default", () => {
    expect(sentryOptions.sendDefaultPii).toBe(false);
    expect(sentryOptions.tracesSampleRate).toBe(0);
    expect(sentryOptions.sampleRate).toBe(1);
    expect(sentryOptions.beforeSend).toBe(scrubEvent);
  });
});
