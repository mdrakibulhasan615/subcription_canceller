import { expect } from "@playwright/test";

// The CLI mail catcher is on 54324. The workflow sets E2E_MAIL_URL from `supabase status`.
const base = () => (process.env.E2E_MAIL_URL ?? "http://127.0.0.1:54324").replace(/\/$/, "");

async function getJson(path: string): Promise<unknown> {
  try {
    const r = await fetch(`${base()}${path}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;

/** Mailpit: GET /api/v1/messages?query=... then /api/v1/message/<ID>. */
async function mailpitBodies(email: string): Promise<string[]> {
  const list = await getJson(`/api/v1/messages?query=${encodeURIComponent(`to:"${email}"`)}`);
  const msgs = isRec(list) && Array.isArray(list.messages) ? list.messages : [];
  const out: string[] = [];
  for (const m of msgs) {
    const d = isRec(m) ? await getJson(`/api/v1/message/${String(m.ID)}`) : null;
    if (isRec(d)) out.push(`${String(d.HTML ?? "")}\n${String(d.Text ?? "")}`);
  }
  return out;
}

/** Inbucket: GET /api/v1/mailbox/<local> then /api/v1/mailbox/<local>/<id>. */
async function inbucketBodies(email: string): Promise<string[]> {
  const local = email.split("@")[0] ?? "";
  // Inbucket may drop the +tag from the mailbox name: try both and match the To address.
  const out: string[] = [];
  for (const box of new Set([local, local.split("+")[0] ?? local])) {
    const list = await getJson(`/api/v1/mailbox/${encodeURIComponent(box)}`);
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const id = isRec(m) ? String(m.id) : "";
      const d = id ? await getJson(`/api/v1/mailbox/${encodeURIComponent(box)}/${id}`) : null;
      if (!isRec(d) || !JSON.stringify(d).includes(email)) continue;
      const body = isRec(d.body) ? d.body : {};
      out.push(`${String(body.html ?? "")}\n${String(body.text ?? "")}`);
    }
  }
  return out;
}

const LINK = /https?:\/\/[^\s"'<>]*\/auth\/v1\/verify\?[^\s"'<>]+/;

async function findLink(email: string): Promise<string | null> {
  for (const bodies of [await mailpitBodies(email), await inbucketBodies(email)]) {
    for (const b of bodies) {
      const m = LINK.exec(b);
      if (m) return m[0].replaceAll("&amp;", "&");
    }
  }
  return null;
}

/** Waits for the magic-link mail to this address and returns the link. */
export async function magicLinkFor(email: string): Promise<string> {
  let link: string | null = null;
  await expect
    .poll(async () => (link = await findLink(email)), {
      timeout: 45_000,
      message: `no magic-link mail for ${email} in the mail catcher at ${base()}`,
    })
    .not.toBeNull();
  return link as unknown as string;
}
