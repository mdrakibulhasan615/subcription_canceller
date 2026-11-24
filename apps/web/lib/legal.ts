export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export const LEGAL_UPDATED = "2026-11-25";
// TODO(go-live): set NEXT_PUBLIC_CONTACT_EMAIL to a real inbox (go-live checklist).
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contact@example.com";
export const LEGAL_BANNER = "Template text. Not yet reviewed by a lawyer.";

export const PRIVACY: LegalSection[] = [
  {
    heading: "What this page covers",
    paragraphs: [
      "This page says what data we keep, why we keep it, and who helps us run the service. The service is in test with a small group.",
    ],
  },
  {
    heading: "Data we keep",
    paragraphs: ["We keep only the data the service needs."],
    bullets: [
      "Account: your email address and your sign-in method (email link or Google).",
      "Profile settings: time zone, reminder hour, default stop days, currency, and the email reminders switch.",
      "Subscriptions: name, price, currency, billing cycle, dates, cancel link, notes, and a card nickname.",
      "Reminders and in-app notifications for your subscriptions.",
      "Usage events (events table): what you did in the app, with your user id and a few details. When you delete your account, we remove the user id. The rows stay, with no link to you.",
      "Feedback (feedback table): your answers to our questions, such as card interest. They are linked to your account. We delete them with your account.",
      "Change log (audit_log table): before and after copies of changes. They can hold subscription data. When you delete your account, we remove the user id. The rows stay, with no link to you.",
      "Waitlist: the email address you give us, where you joined, and the date. A waitlist email has no account.",
      "Problem reports on guides: the message text only. We do not store your IP address. We do not link a report to your account.",
    ],
  },
  {
    heading: "Data we never keep",
    paragraphs: [
      "We never ask for card numbers. Do not type a card number in any field. We do not link to your bank. We do not read your bank data.",
    ],
  },
  {
    heading: "Cookies and analytics",
    paragraphs: [
      "We use one kind of cookie: the sign-in session cookie. We use no cookies and no ad trackers for anything else.",
      "We do not use third-party analytics. We count our own events in our database: what you did (for example, you added a subscription) and the day you opened the app. We store no prices, names, notes, or card details in events. We use no cookies for this. Events are linked to your user id. When you delete your account, we remove the user id and keep the rows.",
    ],
  },
  {
    heading: "IP addresses",
    paragraphs: [
      "To stop abuse, the server holds your IP address in memory for a short time (about 10 minutes) to count requests. We do not write it to the database.",
    ],
  },
  {
    heading: "Who helps us (subprocessors)",
    paragraphs: ["These services process data for us."],
    bullets: [
      "Supabase: database and sign-in.",
      "Vercel: hosting.",
      "Resend: reminder and sign-in emails.",
      "Sentry: error reports. We remove personal data from them before we send them. Sentry is a US service, so error reports leave your country (cross-border transfer).",
      "Google: only if you sign in with Google.",
    ],
  },
  {
    heading: "How long we keep data",
    paragraphs: [
      "We keep your data while your account exists. Guide problem reports stay until we review them. Events with no user id stay for statistics. We remove a waitlist email when you ask us by email.",
    ],
  },
  {
    heading: "Export and delete",
    paragraphs: [
      "You can download your data as JSON and as CSV. You can delete your account at any time. We delete your data at once. Our hosting provider may keep backups for a short time under its own rules. If you joined our waitlist with the same email, we delete that row too.",
      "Some copies stay outside our database for a short time: error reports (Sentry) and email logs (Resend) follow their own rules.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [`Email ${CONTACT_EMAIL} for any question about your data.`],
  },
];

export const TERMS: LegalSection[] = [
  {
    heading: "What the service does",
    paragraphs: [
      "The service reminds you to freeze or close your card before a subscription renews. You can stop payments by acting on the reminder.",
    ],
  },
  {
    heading: "What the service does not do",
    paragraphs: ["Read this part with care."],
    bullets: [
      "The service does not cancel your subscription with the merchant. You must cancel with the merchant.",
      "Blocking or closing a card does not cancel a subscription.",
      "The merchant can still try to charge you. The merchant can treat a declined payment as unpaid debt. The merchant can hold you to the contract.",
      "We do not link to your bank.",
      "We do not give financial advice.",
      "Apple and Google store subscriptions stop only in your own store settings.",
    ],
  },
  {
    heading: "Check each merchant",
    paragraphs: [
      "Each merchant has its own terms. Read them before you act. Our cancel guides can be out of date. Check the source link and the date on each guide.",
    ],
  },
  {
    heading: "Reminders",
    paragraphs: [
      "We send reminders on a best-effort basis. A reminder can arrive late or more than once. We do not promise that a reminder arrives. Keep your own record of the dates that matter.",
    ],
  },
  {
    heading: "Service in test",
    paragraphs: [
      "The service is in test with a small group. Features can change. Data can be lost. We can stop the service.",
    ],
  },
  {
    heading: "Use of the service",
    paragraphs: ["You agree to these rules."],
    bullets: [
      "Give true information.",
      "Do not attack, overload, or probe the service.",
      "Do not use the service to break the law.",
      "Do not type card numbers or other secrets in any field.",
    ],
  },
  {
    heading: "No warranty and limited liability",
    paragraphs: [
      "We provide the service as is, without warranty of any kind. To the extent the law allows, we are not liable for lost payments, fees, charges, or other loss that comes from your use of the service.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [`Email ${CONTACT_EMAIL} with any question about these terms.`],
  },
];
