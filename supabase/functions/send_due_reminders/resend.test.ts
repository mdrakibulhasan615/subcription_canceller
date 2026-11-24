import { describe, expect, it, vi } from "vitest";
import { createResendTransport } from "./resend";

const msg = { to: "a@example.com", subject: "S", text: "T", html: "<p>H</p>", idempotencyKey: "r1" };
const make = (fetchFn: typeof fetch) =>
  createResendTransport({ apiKey: "re_secret", from: "StopDate <r@x.com>", fetch: fetchFn });

describe("createResendTransport", () => {
  it("posts the right request and returns the id", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
    expect(await make(f as unknown as typeof fetch).sendEmail(msg)).toBe("re_1");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_secret");
    expect(init.headers["Idempotency-Key"]).toBe("r1");
    expect(JSON.parse(init.body)).toEqual({
      from: "StopDate <r@x.com>",
      to: ["a@example.com"],
      subject: "S",
      text: "T",
      html: "<p>H</p>",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("maps errors with no key and no body in the message", async () => {
    const f = vi.fn().mockResolvedValue(new Response("re_secret leaked", { status: 500 }));
    const err = await make(f as unknown as typeof fetch)
      .sendEmail(msg)
      .catch((e: Error) => e);
    expect((err as Error).message).toBe("resend 500");
    const n = vi.fn().mockRejectedValue(new Error("boom re_secret"));
    await expect(make(n as unknown as typeof fetch).sendEmail(msg)).rejects.toThrow(
      "resend network error",
    );
    const bad = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(make(bad as unknown as typeof fetch).sendEmail(msg)).rejects.toThrow(
      "resend bad response",
    );
  });
});
