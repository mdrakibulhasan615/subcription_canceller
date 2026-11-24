// Resend transport. Pure TS: fetch is injected so Vitest can fake it.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}
export interface EmailTransport {
  /** Returns the provider message id. */
  sendEmail(m: EmailMessage): Promise<string>;
}

export function createResendTransport(o: {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}): EmailTransport {
  const doFetch = o.fetch ?? globalThis.fetch;
  return {
    async sendEmail(m) {
      let res: Response;
      try {
        res = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${o.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": m.idempotencyKey,
          },
          body: JSON.stringify({
            from: o.from,
            to: [m.to],
            subject: m.subject,
            text: m.text,
            html: m.html,
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // The original error can echo request details. Keep the message plain.
        throw new Error("resend network error");
      }
      if (!res.ok) throw new Error(`resend ${res.status}`);
      const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
      if (!body || typeof body.id !== "string" || !body.id) throw new Error("resend bad response");
      return body.id;
    },
  };
}
