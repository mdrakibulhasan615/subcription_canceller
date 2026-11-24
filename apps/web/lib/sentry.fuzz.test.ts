import { describe, expect, it } from "vitest";
import { scrubEvent, scrubString, beforeBreadcrumb, sentryOptions } from "./sentry";

const CARD = "4111 1111 1111 1111";
const MAIL = "bob@example.com";
const leaks = (o: unknown) => /bob@example|4111[ -]?1111|4111111111111111/.test(JSON.stringify(o));

describe("scrub fuzz", () => {
  it("options", () => {
    expect(sentryOptions.sendDefaultPii).toBe(false);
    expect(sentryOptions.tracesSampleRate).toBe(0);
  });
  it("strings", () => {
    for (const s of [
      `a ${MAIL} b`,
      CARD,
      "4111-1111-1111-1111",
      "4111111111111111",
      "4111111111111111111",
      "x4111 1111 1111 1111y",
      `${MAIL}${MAIL}`,
      "a@b",
      "4111  1111  1111  1111",
      "4111.1111.1111.1111",
      "４１１１１１１１１１１１１１１１",
    ]) {
      const out = scrubString(s);
      expect(leaks(out), s).toBe(false);
    }
  });
  it("odd shapes never throw", () => {
    const odd: unknown[] = [
      {},
      { request: {} },
      { request: null },
      { request: { url: 5 } },
      { exception: { values: null } },
      { exception: { values: [null] } },
      { breadcrumbs: [null] },
      { breadcrumbs: "x" },
      { message: 5 },
      { exception: { values: [{ value: 7 }] } },
      { request: { url: "http://[bad" } },
    ];
    for (const e of odd) expect(() => scrubEvent(e as never)).not.toThrow();
  });
  it("full leak check (extra, contexts, tags, transaction, deep nesting)", () => {
    const e = {
      message: `fail for ${MAIL} ${CARD}`,
      user: { email: MAIL, ip_address: "1.2.3.4" },
      request: {
        url: `https://x.test/a?email=${MAIL}`,
        query_string: `e=${MAIL}`,
        cookies: { sb: MAIL },
        headers: { cookie: MAIL },
        data: { card: CARD },
      },
      exception: { values: [{ type: "E", value: `bad ${MAIL} ${CARD}` }] },
      breadcrumbs: [
        { category: "ui", message: MAIL, data: { a: { b: { c: CARD } } } },
        {
          category: "fetch",
          data: { url: `https://x.test/p?e=${MAIL}`, method: "POST", request_body: MAIL },
        },
        { category: "console", message: MAIL },
        { category: "navigation", data: { from: `/u/${MAIL}`, to: "/x" } },
        { category: "ui", data: { l1: { l2: { l3: { l4: { l5: { l6: { l7: MAIL } } } } } } } },
      ],
      extra: { who: MAIL },
      contexts: { c: { card: CARD } },
      tags: { t: MAIL },
      transaction: `/u/${MAIL}`,
    };
    const out = scrubEvent(e as never);
    const s = JSON.stringify(out);
    for (const [name, re] of Object.entries({
      extra: /extra/,
      contexts: /"contexts"/,
      tags: /"tags"/,
      transaction: /transaction/,
      deep: /l7/,
    })) {
      if (re.test(s) && leaks(out)) console.log("LEAK via", name);
    }
    expect(leaks(out)).toBe(false);
  });
  it("breadcrumb url path with email", () => {
    const b = beforeBreadcrumb({ category: "fetch", data: { url: `https://x.test/u/${MAIL}/z` } });
    expect(leaks(b)).toBe(false);
  });
  it("request url path with email", () => {
    const o = scrubEvent({ request: { url: `https://x.test/u/${MAIL}` } } as never);
    expect(leaks(o)).toBe(false);
  });
});
