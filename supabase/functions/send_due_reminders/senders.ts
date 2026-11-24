import type { Alerter, ChannelSender, ClaimedReminder } from "./handler.ts";

// In-app reminders are rows the app reads. Nothing to send.
export const inAppSender: ChannelSender = { send: () => Promise.resolve() };

// T-011 replaces this with a real email sender.
export const stubEmailSender: ChannelSender = {
  send: () => Promise.reject(new Error("email not configured")),
};

/** Emails the founder through the given email sender. Throws if the address is not set. */
export function alertFounder(email: ChannelSender, founderEmail: string | undefined): Alerter {
  return {
    async alert(r: ClaimedReminder, error: string) {
      if (!founderEmail) throw new Error("FOUNDER_ALERT_EMAIL not set");
      await email.send({
        ...r,
        channel: "email",
        userEmail: founderEmail,
        subName: `ALERT: reminder ${r.id} failed (${error})`,
      });
    },
  };
}
