// Pure email text. No Deno or npm imports. ASD-STE style. Never says "cancelled" for our own action.
import { keyDate, type ClaimedReminder } from "./handler.ts";

export interface TemplateOpts {
  appUrl: string;
  brand: string;
}
export interface Email {
  subject: string;
  text: string;
  html: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "2026-12-12" gives "12 Dec 2026". UTC date only. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

function formatPrice(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** Only http and https links. Anything else (javascript:, empty) gives null. */
export function safeCancelUrl(url: string | null): string | null {
  const u = (url ?? "").trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const base = (u: string) => u.replace(/\/+$/, "");

export function renderReminderEmail(r: ClaimedReminder, o: TemplateOpts): Email {
  const name = oneLine(r.subName);
  const key = keyDate(r);
  const date = key ? formatDate(key) : null;
  const stop = date ? `Payments stop on ${date}.` : "Payments stop soon.";
  const price = r.priceMinor >= 0 ? `Price: ${formatPrice(r.priceMinor, r.currency)}.` : null;
  const freeze = "Freeze or close your card a few days before the renewal date, not on it.";
  const block = `Blocking a card does not cancel the subscription. Cancel with ${name} too.`;
  const cancel = safeCancelUrl(r.cancelUrl);
  const app = `${base(o.appUrl)}/app/subscriptions`;
  const settings = `${base(o.appUrl)}/app/settings`;
  const why = `You got this email because you set reminders in ${o.brand}.`;

  const subject = `${name}: ${date ? `payments stop on ${date}` : "payments stop soon"}`;

  const text = [
    name,
    "",
    stop,
    ...(price ? [price] : []),
    freeze,
    block,
    ...(cancel ? [`Cancel link: ${cancel}`] : []),
    "",
    `Open your subscriptions: ${app}`,
    "",
    why,
    `Change this in your notification settings: ${settings}`,
  ].join("\n");

  const a = (href: string, label: string) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
  const html = [
    `<h1>${escapeHtml(name)}</h1>`,
    `<p><strong>${escapeHtml(stop)}</strong></p>`,
    ...(price ? [`<p>${escapeHtml(price)}</p>`] : []),
    `<p>${escapeHtml(freeze)}</p>`,
    `<p>${escapeHtml(block)}</p>`,
    ...(cancel ? [`<p>${a(cancel, "Cancel with " + name)}</p>`] : []),
    `<p>${a(app, "Open your subscriptions")}</p>`,
    `<hr>`,
    `<p style="font-size:14px">${escapeHtml(why)} ${a(settings, "Change this in your notification settings")}.</p>`,
  ].join("\n");

  return { subject, text, html };
}

/** For the founder. Holds ids and the error only: no user email, no subscription name. */
export function renderFounderAlert(r: ClaimedReminder, error: string, o: TemplateOpts): Email {
  const rows: [string, string][] = [
    ["Reminder id", r.id],
    ["Type", r.type],
    ["Channel", r.channel],
    ["Attempts", String(r.attempts + 1)],
    ["Error", error],
    ["Fire at", r.fireAt],
    ["User id", r.userId],
    ["Subscription id", r.subscriptionId],
  ];
  return {
    subject: `${o.brand} ALERT: reminder failed (${r.channel})`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    html: `<ul>${rows.map(([k, v]) => `<li>${escapeHtml(k)}: ${escapeHtml(v)}</li>`).join("")}</ul>`,
  };
}
