import { addDays, type IsoDate } from "./dates";
import { isValidTimezone, localToUtc } from "./timezone";

export type ReminderType = "stop_date" | "renewal" | "trial_end";
export type ReminderChannel = "in_app" | "email" | "push";
export type ReminderStatus = "pending" | "sent" | "failed" | "skipped";

export interface ReminderSubInput {
  stopDate: IsoDate | null;
  nextRenewalDate: IsoDate | null;
  isTrial: boolean;
  trialEndDate: IsoDate | null;
  stopConfirmedAt: string | null;
  merchantCancelledAt: string | null;
  archivedAt: string | null;
}

export interface ReminderProfile {
  timezone: string;
  reminderDays: number[];
  sendHour?: number;
  channels?: ReminderChannel[];
}

export interface DesiredReminder {
  type: ReminderType;
  channel: ReminderChannel;
  fireAt: string;
}

export interface ExistingReminder extends DesiredReminder {
  id: string;
  status: ReminderStatus;
}

export interface ReminderDiff {
  toInsert: DesiredReminder[];
  toCancel: string[];
  toReopen: string[];
}

const key = (r: DesiredReminder) => `${r.type}|${r.channel}|${new Date(r.fireAt).toISOString()}`;

function isInactive(sub: ReminderSubInput): boolean {
  return Boolean(sub.archivedAt || sub.stopConfirmedAt || sub.merchantCancelledAt);
}

export function desiredReminders(
  sub: ReminderSubInput,
  profile: ReminderProfile,
  now: Date,
): DesiredReminder[] {
  const hour = profile.sendHour ?? 9;
  const channels = profile.channels ?? ["in_app", "email"];
  if (!isValidTimezone(profile.timezone)) {
    throw new RangeError(`Bad timezone: ${profile.timezone}`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`Bad sendHour: ${hour}`);
  }
  if (!profile.reminderDays.every(Number.isInteger)) {
    throw new RangeError("reminderDays must be integers");
  }
  if (isInactive(sub)) return [];

  const days = [...new Set(profile.reminderDays.filter((d) => d > 0))];
  const anchors: { type: ReminderType; date: IsoDate; days: number[] }[] = [];
  const { stopDate, nextRenewalDate } = sub;
  if (stopDate && !(nextRenewalDate && stopDate > nextRenewalDate)) {
    anchors.push({ type: "stop_date", date: stopDate, days });
  }
  if (sub.isTrial) {
    if (sub.trialEndDate) anchors.push({ type: "trial_end", date: sub.trialEndDate, days });
  } else if (nextRenewalDate) {
    anchors.push({ type: "renewal", date: nextRenewalDate, days: [1] });
  }

  const out: DesiredReminder[] = [];
  for (const a of anchors) {
    for (const d of a.days) {
      const fireAt = localToUtc(addDays(a.date, -d), hour, 0, profile.timezone);
      if (fireAt.getTime() <= now.getTime()) continue;
      for (const channel of channels) {
        out.push({ type: a.type, channel, fireAt: fireAt.toISOString() });
      }
    }
  }
  return out.sort(
    (x, y) =>
      x.fireAt.localeCompare(y.fireAt) ||
      x.type.localeCompare(y.type) ||
      x.channel.localeCompare(y.channel),
  );
}

export function diffReminders(
  desired: DesiredReminder[],
  existing: ExistingReminder[],
  now: Date,
  opts: { cancelOverdue?: boolean } = {},
): ReminderDiff {
  const want = new Set(desired.map(key));
  const have = new Set(existing.map(key));
  const t = now.getTime();
  return {
    toInsert: desired.filter((r) => !have.has(key(r))),
    toReopen: existing.filter((r) => r.status === "skipped" && want.has(key(r))).map((r) => r.id),
    toCancel: existing
      .filter(
        (r) =>
          r.status === "pending" &&
          !want.has(key(r)) &&
          (opts.cancelOverdue || new Date(r.fireAt).getTime() > t),
      )
      .map((r) => r.id),
  };
}

export interface ReminderWrites {
  insert: {
    subscription_id: string;
    user_id: string;
    type: ReminderType;
    channel: ReminderChannel;
    fire_at: string;
  }[];
  skipIds: string[];
  reopenIds: string[];
}

/** Maps a diff to DB rows and id lists. The caller does the I/O. */
export function reminderWrites(
  diff: ReminderDiff,
  subscriptionId: string,
  userId: string,
): ReminderWrites {
  return {
    insert: diff.toInsert.map((r) => ({
      subscription_id: subscriptionId,
      user_id: userId,
      type: r.type,
      channel: r.channel,
      fire_at: r.fireAt,
    })),
    skipIds: [...diff.toCancel],
    reopenIds: [...diff.toReopen],
  };
}

export function planReminders(
  sub: ReminderSubInput,
  profile: ReminderProfile,
  existing: ExistingReminder[],
  now: Date,
): ReminderDiff {
  return diffReminders(desiredReminders(sub, profile, now), existing, now, {
    cancelOverdue: isInactive(sub),
  });
}
