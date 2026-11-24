"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { CURRENCIES } from "@app/core";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  describedBy,
  FIELD_LABELS,
  FIELD_ORDER,
  type FieldName,
  type FormValues,
  type SettingsState,
} from "./form-utils";

type Action = (prev: SettingsState, fd: FormData) => Promise<SettingsState>;

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground aria-invalid:border-destructive";
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function Field(props: {
  name: FieldName;
  help?: string;
  error?: string;
  children: (a: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const { name, help, error } = props;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{FIELD_LABELS[name]}</Label>
      {props.children({
        id: name,
        "aria-describedby": describedBy(name, !!help, !!error),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {help && (
        <p id={`${name}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="flex items-start gap-1 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function SettingsForm({
  action,
  initial,
  initialState = { status: "idle" },
}: {
  action: Action;
  initial: FormValues;
  initialState?: SettingsState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [zones, setZones] = useState<string[]>([]);
  const [detected, setDetected] = useState<string | null>(null);
  const tzRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const err = state.status === "error" ? state : null;
  const fieldErrors = err?.fieldErrors ?? {};
  const errorFields = FIELD_ORDER.filter((f) => fieldErrors[f]);
  const showSummary = !!err && (err.message !== null || errorFields.length >= 2);
  const val = (f: FieldName) => err?.values[f] ?? initial[f];

  // Browser-only facts: the list of zones and the detected zone differ from the server.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setZones(Intl.supportedValuesOf("timeZone"));
      const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (initial.timezone === "UTC" && here && here !== "UTC" && tzRef.current) {
        tzRef.current.value = here;
        setDetected(here);
      }
    } catch {
      // Old browser: the text input still works.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial.timezone]);

  useEffect(() => {
    if (!err) return;
    if (showSummary) summaryRef.current?.focus();
    else if (errorFields[0]) document.getElementById(errorFields[0])?.focus();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={formAction} noValidate className="mt-8 flex max-w-prose flex-col gap-6">
      <div
        ref={summaryRef}
        tabIndex={-1}
        hidden={!showSummary}
        className="rounded-lg border border-destructive p-4 text-destructive"
      >
        {showSummary && (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {err.message ?? "Fix these fields:"}
            </p>
            {errorFields.length > 0 && (
              <ul className="mt-2 list-disc pl-6 text-sm">
                {errorFields.map((f) => (
                  <li key={f}>
                    <a href={`#${f}`} className="underline">
                      {FIELD_LABELS[f]}
                    </a>
                    : {fieldErrors[f]}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Field name="display_name" error={fieldErrors.display_name}>
        {(a) => (
          <Input
            name="display_name"
            autoComplete="name"
            defaultValue={val("display_name")}
            {...a}
          />
        )}
      </Field>

      <Field
        name="timezone"
        help={detected ? "Detected from your browser" : "Example: Asia/Kuala_Lumpur"}
        error={fieldErrors.timezone}
      >
        {(a) => (
          <>
            <Input
              ref={tzRef}
              name="timezone"
              list="timezone-list"
              autoComplete="off"
              defaultValue={val("timezone")}
              {...a}
            />
            <datalist id="timezone-list">
              {zones.map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </>
        )}
      </Field>

      <Field name="currency" error={fieldErrors.currency}>
        {(a) => (
          <select name="currency" defaultValue={val("currency")} className={selectClass} {...a}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        name="default_stop_days_before"
        help="New subscriptions stop this many days before renewal."
        error={fieldErrors.default_stop_days_before}
      >
        {(a) => (
          <Input
            name="default_stop_days_before"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            step={1}
            defaultValue={val("default_stop_days_before")}
            {...a}
          />
        )}
      </Field>

      <Field
        name="reminder_days"
        help="Days before the stop date. 1 to 5 numbers"
        error={fieldErrors.reminder_days}
      >
        {(a) => (
          <Input name="reminder_days" inputMode="text" defaultValue={val("reminder_days")} {...a} />
        )}
      </Field>

      <Field name="reminder_hour" error={fieldErrors.reminder_hour}>
        {(a) => (
          <select
            name="reminder_hour"
            defaultValue={val("reminder_hour")}
            className={selectClass}
            {...a}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="flex flex-col gap-1">
        <div className="flex min-h-11 items-center gap-3">
          <input
            id="email_reminders"
            name="email_reminders"
            type="checkbox"
            defaultChecked={val("email_reminders") === "on"}
            aria-describedby="email_reminders-help"
            className="size-5 accent-primary"
          />
          <Label htmlFor="email_reminders">{FIELD_LABELS.email_reminders}</Label>
        </div>
        <p id="email_reminders-help" className="text-sm text-muted-foreground">
          In-app reminders stay on.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving..." : "Save"}
        </Button>
        <p role="status" className="flex items-center gap-2 text-sm text-success-fg">
          {state.status === "saved" && !pending && (
            <>
              <CircleCheck className="size-4" aria-hidden="true" />
              Saved
            </>
          )}
        </p>
      </div>
    </form>
  );
}
