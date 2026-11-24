import Link from "next/link";
import type { ReactNode } from "react";
import { CURRENCIES, type ProfileSettings } from "@app/core";
import { CircleAlert } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { FIELD_MESSAGES } from "../../../lib/profile-settings";
import { FIELD_LABELS, MESSAGES } from "../settings/form-utils";
import { saveOnboardingStep } from "./actions";
import { FocusSummary } from "./focus-summary";
import { BASE, ONBOARDING_FIELDS } from "./steps";
import { TzInput } from "./tz-input";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground aria-invalid:border-destructive";
const linkBtn =
  "inline-flex h-11 items-center justify-center rounded-md px-4 font-medium hover:opacity-90";
const primaryLink = `${linkBtn} bg-primary text-primary-foreground`;
const outlineLink = `${linkBtn} border border-input bg-background text-foreground`;
const h1 = "text-[32px] leading-[38px] md:text-5xl md:leading-[52px]";
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export type StepNo = 1 | 2 | 3;
type Key = keyof ProfileSettings;
export type StepErrors = { fields: Key[]; message: string | null };

export function parseStep(raw: unknown): StepNo {
  return raw === "2" ? 2 : raw === "3" ? 3 : 1;
}

/** Only whitelisted keys come back. Anything else in the URL is ignored. */
export function parseErrors(step: StepNo, raw: unknown): StepErrors {
  const parts = typeof raw === "string" ? raw.split(",") : [];
  const allowed = step === 3 ? [] : ONBOARDING_FIELDS[step];
  const message = parts.includes("rebuild_failed")
    ? MESSAGES.rebuild_failed
    : parts.includes("server")
      ? MESSAGES.server
      : null;
  return { fields: allowed.filter((k) => parts.includes(k)), message };
}

function Summary({ fields, message }: StepErrors) {
  if (!fields.length && !message) return null;
  return (
    <FocusSummary>
      <p className="flex items-center gap-2 font-semibold">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        {message ?? "Fix these fields:"}
      </p>
      {fields.length > 0 && (
        <ul className="mt-2 list-disc pl-6 text-sm">
          {fields.map((f) => (
            <li key={f}>
              <a href={`#${f}`} className="underline">
                {FIELD_LABELS[f]}
              </a>
              : {FIELD_MESSAGES[f]}
            </li>
          ))}
        </ul>
      )}
    </FocusSummary>
  );
}

function FieldError({ name, fields }: { name: Key; fields: Key[] }) {
  return fields.includes(name) ? (
    <p id={`${name}-error`} className="flex items-start gap-1 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {FIELD_MESSAGES[name]}
    </p>
  ) : null;
}

/** aria-describedby and aria-invalid for one field. */
function a11y(fields: Key[], k: Key, help?: boolean) {
  const bad = fields.includes(k);
  const ids = [help && `${k}-help`, bad && `${k}-error`].filter(Boolean).join(" ");
  return {
    "aria-describedby": ids || undefined,
    ...(bad ? { "aria-invalid": true as const } : {}),
  };
}

function Head({ step, title, lead }: { step: StepNo; title: string; lead: string }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">Step {step} of 3</p>
      <h1 className={`mt-2 ${h1}`}>{title}</h1>
      <p className="mt-4 max-w-prose text-lg text-muted-foreground">{lead}</p>
    </>
  );
}

function Actions({ next }: { next: StepNo }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button type="submit">Continue</Button>
      <Link href={`${BASE}?step=${next}`} className={outlineLink}>
        Skip for now
      </Link>
    </div>
  );
}

function Field({ name, help, children }: { name: Key; help?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{FIELD_LABELS[name]}</Label>
      {children}
      {help && (
        <p id={`${name}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
    </div>
  );
}

const formClass = "mt-8 flex max-w-prose flex-col gap-6";

export function OnboardingView({
  step,
  profile,
  errors,
}: {
  step: StepNo;
  profile: ProfileSettings;
  errors: StepErrors;
}) {
  const f = errors.fields;
  if (step === 3) {
    return (
      <>
        <Head
          step={3}
          title="Add your first subscription"
          lead="Pick one you pay for. You set a stop date and we remind you before it."
        />
        <ul className="mt-8 flex max-w-prose flex-col items-start gap-4">
          <li>
            <Link href="/app/subscriptions/new" className={primaryLink}>
              Add subscription
            </Link>
          </li>
          <li>
            <Link href="/app/subscriptions/new?trial=1" className={outlineLink}>
              Free trial? Start here
            </Link>
          </li>
          <li>
            <Link href="/app/import" className={outlineLink}>
              Import CSV
            </Link>
          </li>
          <li>
            <Link href="/app" className="inline-flex min-h-11 items-center underline">
              Skip, go to dashboard
            </Link>
          </li>
        </ul>
      </>
    );
  }
  if (step === 1) {
    return (
      <>
        <Head
          step={1}
          title="Set your timezone and currency"
          lead="We use your timezone to send reminders at your local hour."
        />
        <Summary {...errors} />
        <form action={saveOnboardingStep.bind(null, 1)} noValidate className={formClass}>
          <Field name="timezone" help="Example: Asia/Kuala_Lumpur">
            <TzInput
              initial={profile.timezone}
              describedBy={a11y(f, "timezone", true)["aria-describedby"]}
              invalid={f.includes("timezone")}
            />
            <FieldError name="timezone" fields={f} />
          </Field>
          <Field name="currency">
            <select
              id="currency"
              name="currency"
              defaultValue={profile.currency}
              className={selectClass}
              {...a11y(f, "currency")}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError name="currency" fields={f} />
          </Field>
          <Actions next={2} />
        </form>
      </>
    );
  }
  return (
    <>
      <Head
        step={2}
        title="Choose your reminders"
        lead="We remind you before each stop date. You can change this later in settings."
      />
      <Summary {...errors} />
      <form action={saveOnboardingStep.bind(null, 2)} noValidate className={formClass}>
        <Field
          name="default_stop_days_before"
          help="New subscriptions stop this many days before renewal."
        >
          <Input
            id="default_stop_days_before"
            name="default_stop_days_before"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            step={1}
            defaultValue={profile.default_stop_days_before}
            {...a11y(f, "default_stop_days_before", true)}
          />
          <FieldError name="default_stop_days_before" fields={f} />
        </Field>
        <Field name="reminder_days" help="Days before the stop date. 1 to 5 numbers">
          <Input
            id="reminder_days"
            name="reminder_days"
            inputMode="text"
            defaultValue={profile.reminder_days.join(", ")}
            {...a11y(f, "reminder_days", true)}
          />
          <FieldError name="reminder_days" fields={f} />
        </Field>
        <Field name="reminder_hour">
          <select
            id="reminder_hour"
            name="reminder_hour"
            defaultValue={profile.reminder_hour}
            className={selectClass}
            {...a11y(f, "reminder_hour")}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <FieldError name="reminder_hour" fields={f} />
        </Field>
        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-center gap-3">
            <input
              id="email_reminders"
              name="email_reminders"
              type="checkbox"
              defaultChecked={profile.email_reminders}
              aria-describedby="email_reminders-help"
              className="size-5 accent-primary"
            />
            <Label htmlFor="email_reminders">{FIELD_LABELS.email_reminders}</Label>
          </div>
          <p id="email_reminders-help" className="text-sm text-muted-foreground">
            In-app reminders stay on.
          </p>
        </div>
        <Actions next={3} />
      </form>
    </>
  );
}
