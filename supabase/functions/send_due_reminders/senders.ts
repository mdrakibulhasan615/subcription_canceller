import type { Alerter, ChannelSender, ClaimedReminder } from "./handler.ts";
import { renderFounderAlert, renderReminderEmail, type TemplateOpts } from "./email-template.ts";
import type { EmailTransport } from "./resend.ts";

// In-app reminders are rows the app reads. Nothing to send.
export const inAppSender: ChannelSender = { send: () => Promise.resolve() };

// Used when RESEND_API_KEY or EMAIL_FROM is not set. The row retries and then fails.
export const stubEmailSender: ChannelSender = {
  send: () => Promise.reject(new Error("email not configured")),
};

export function emailReminderSender(transport: EmailTransport, opts: TemplateOpts): ChannelSender {
  return {
    async send(r) {
      if (!r.userEmail) throw new Error("user has no email");
      const e = renderReminderEmail(r, opts);
      return transport.sendEmail({ to: r.userEmail, ...e, idempotencyKey: r.id });
    },
  };
}

/** Emails the founder. Throws if the transport or address is not set. */
export function alertFounder(
  transport: EmailTransport | null,
  founderEmail: string | undefined,
  opts: TemplateOpts,
): Alerter {
  return {
    async alert(r: ClaimedReminder, error: string) {
      if (!founderEmail) throw new Error("FOUNDER_ALERT_EMAIL not set");
      if (!transport) throw new Error("email not configured");
      await transport.sendEmail({
        to: founderEmail,
        ...renderFounderAlert(r, error, opts),
        idempotencyKey: `alert-${r.id}`,
      });
    },
  };
}
