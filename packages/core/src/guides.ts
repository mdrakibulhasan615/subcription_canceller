import { z } from "zod";

export const STALE_DAYS = 120;

const httpsUrl = z
  .url()
  .max(500)
  .refine((v) => v.startsWith("https://"), "https only");

export const guideKindSchema = z.enum(["cancel", "provider", "store"]);
export type GuideKind = z.infer<typeof guideKindSchema>;

export const guideSlugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const guideStepSchema = z.object({
  text: z.string().trim().min(1).max(500),
  link: httpsUrl.optional(),
  note: z.string().max(300).optional(),
});
export const guideStepsSchema = z.array(guideStepSchema).max(30);
export type GuideStep = z.infer<typeof guideStepSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(v)), "invalid date");

export const guideSchema = z.object({
  kind: guideKindSchema,
  service_slug: guideSlugSchema,
  title: z.string().min(1).max(120),
  steps: guideStepsSchema.min(1),
  url: httpsUrl.nullable().default(null),
  source_url: httpsUrl.nullable().default(null),
  contact_phone: z.string().max(40).nullable().default(null),
  contact_email: z.string().email().nullable().default(null),
  last_checked_at: isoDate.nullable().default(null),
  updated_at: z.string().optional(),
});
export type Guide = z.infer<typeof guideSchema>;

export const guideReportSchema = z.object({
  kind: guideKindSchema,
  slug: guideSlugSchema,
  message: z.string().trim().min(5).max(500),
  website: z.string().optional(),
});

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
};

/** No check date means stale. More than STALE_DAYS old means stale. */
export function isGuideStale(lastCheckedAt: string | null | undefined, todayIso: string): boolean {
  if (!lastCheckedAt) return true;
  return dayNumber(todayIso) - dayNumber(lastCheckedAt) > STALE_DAYS;
}

const ALIASES: [string, GuideKind, string][] = [
  ["netflix", "cancel", "netflix"],
  ["spotify", "cancel", "spotify"],
  ["youtube premium", "cancel", "youtube-premium"],
  ["youtube", "cancel", "youtube-premium"],
  ["yt premium", "cancel", "youtube-premium"],
  ["disney+", "cancel", "disney-plus"],
  ["disney plus", "cancel", "disney-plus"],
  ["amazon prime", "cancel", "amazon-prime"],
  ["prime video", "cancel", "amazon-prime"],
  ["prime", "cancel", "amazon-prime"],
  ["adobe", "cancel", "adobe-creative-cloud"],
  ["creative cloud", "cancel", "adobe-creative-cloud"],
  ["microsoft 365", "cancel", "microsoft-365"],
  ["office 365", "cancel", "microsoft-365"],
  ["m365", "cancel", "microsoft-365"],
  ["chatgpt", "cancel", "chatgpt-plus"],
  ["chatgpt plus", "cancel", "chatgpt-plus"],
  ["openai", "cancel", "chatgpt-plus"],
  ["app store", "store", "apple-app-store"],
  ["itunes", "store", "apple-app-store"],
  ["google play", "store", "google-play"],
  ["play store", "store", "google-play"],
  ["wise", "provider", "wise"],
];

/** Whole-word alias match on a subscription name. Longest alias wins. */
export function matchGuideSlug(name: string): { kind: GuideKind; slug: string } | null {
  const text = ` ${name
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  let best: [string, GuideKind, string] | null = null;
  for (const a of ALIASES) {
    if (text.includes(` ${a[0]} `) && (!best || a[0].length > best[0].length)) best = a;
  }
  return best ? { kind: best[1], slug: best[2] } : null;
}
