"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BILLING_CYCLES,
  CURRENCIES,
  defaultStopDate,
  isIsoDate,
  stopDateWarnings,
  type BillingCycle,
  type Currency,
} from "@app/core";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { looksLikeCardNumber } from "../../../lib/card-guard";
import { previewCost } from "../../../lib/sub-cost";
import {
  CARD_MESSAGE,
  SUB_FIELDS,
  type FieldErrors,
  type SubField,
} from "../../../lib/subscriptions";
import { describedBy } from "../settings/form-utils";
import { CYCLE_LABELS, FIELD_LABELS, PAYMENT_LABELS, type SubState } from "./form-utils";

type Action = (prev: SubState, fd: FormData) => Promise<SubState>;
export type SubFormValues = Record<Exclude<SubField, "is_trial">, string> & { is_trial: boolean };

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground aria-invalid:border-destructive";
function Field(props: {
  name: SubField;
  label?: string;
  help?: ReactNode;
  /** Help text is a polite live region (the price preview). */
  live?: boolean;
  error?: string;
  children: (a: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}) {
  const { name, help, error } = props;
  const hasHelp = help !== undefined;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>{props.label ?? FIELD_LABELS[name]}</Label>
      {props.children({
        id: name,
        "aria-describedby": describedBy(name, hasHelp, !!error),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {hasHelp &&
        (props.live ? (
          <div id={`${name}-help`} aria-live="polite" className="text-sm text-muted-foreground">
            {help}
          </div>
        ) : (
          <div id={`${name}-help`} className="text-sm text-muted-foreground">
            {help}
          </div>
        ))}
      {error && (
        <p id={`${name}-error`} className="flex items-start gap-1 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function SubForm({
  action,
  initial,
  isNew,
  defaultStopDays,
  today,
  trialMode = false,
}: {
  trialMode?: boolean;
  action: Action;
  initial: SubFormValues;
  isNew: boolean;
  defaultStopDays: number;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<SubState, FormData>(action, {
    status: "idle",
  });
  const [v, setV] = useState(initial);
  const stopTouched = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const set = (k: SubField) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  const err = state.status === "error" ? state : null;
  // Card-like text is blocked here too, so the number never leaves the browser.
  const cardErrors: FieldErrors = {};
  if (looksLikeCardNumber(v.card_nickname)) cardErrors.card_nickname = CARD_MESSAGE;
  if (looksLikeCardNumber(v.notes)) cardErrors.notes = CARD_MESSAGE;
  const fieldErrors: FieldErrors = { ...err?.fieldErrors, ...cardErrors };
  const labels: Record<SubField, string> = trialMode
    ? { ...FIELD_LABELS, price: "Price after the trial", trial_end_date: "Trial ends on" }
    : FIELD_LABELS;
  if (trialMode && fieldErrors.next_renewal_date) {
    // The renewal input is hidden here: show its error on the trial end date.
    fieldErrors.trial_end_date ??= fieldErrors.next_renewal_date;
    delete fieldErrors.next_renewal_date;
  }
  const errorFields = SUB_FIELDS.filter((f) => fieldErrors[f]);
  const showSummary = !!err && (err.message !== null || errorFields.length >= 2);
  const savedId = err?.savedId ?? "";

  useEffect(() => {
    if (!err) return;
    if (showSummary) summaryRef.current?.focus();
    else if (errorFields[0]) document.getElementById(errorFields[0])?.focus();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const interval = Number(v.billing_interval);
  const cost = previewCost(
    v.price,
    v.currency as Currency,
    v.billing_cycle as BillingCycle,
    /^\d+$/.test(v.billing_interval) ? interval : NaN,
  );
  const warnings =
    isIsoDate(v.next_renewal_date) && isIsoDate(v.stop_date)
      ? stopDateWarnings({ stop_date: v.stop_date, next_renewal_date: v.next_renewal_date }, today)
      : [];

  const onRenewal = (e: { target: { value: string } }) => {
    const r = e.target.value;
    setV((p) => ({
      ...p,
      next_renewal_date: r,
      // Trial: the first payment is the trial end date.
      ...(trialMode ? { trial_end_date: r } : {}),
      // Only on a new form, and only until the user types their own stop date.
      ...(isNew && !stopTouched.current && isIsoDate(r)
        ? { stop_date: defaultStopDate(r, defaultStopDays) }
        : {}),
    }));
  };

  return (
    <form
      action={(fd) => {
        const bad = errorFields.find((f) => cardErrors[f]);
        if (bad) document.getElementById(bad)?.focus();
        else formAction(fd);
      }}
      noValidate
      className="mt-8 flex max-w-prose flex-col gap-6"
    >
      <input type="hidden" name="sub_id" value={savedId} />
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
                      {labels[f]}
                    </a>
                    : {fieldErrors[f]}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Field name="name" error={fieldErrors.name}>
        {(a) => <Input name="name" value={v.name} onChange={set("name")} {...a} />}
      </Field>

      <Field
        name="price"
        label={labels.price}
        error={fieldErrors.price}
        live
        help={cost ? `About ${cost.monthly} / month, ${cost.yearly} / year` : ""}
      >
        {(a) => (
          <Input
            name="price"
            inputMode="decimal"
            autoComplete="off"
            value={v.price}
            onChange={set("price")}
            {...a}
          />
        )}
      </Field>

      <Field name="currency" error={fieldErrors.currency}>
        {(a) => (
          <select
            name="currency"
            value={v.currency}
            onChange={set("currency")}
            className={selectClass}
            {...a}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field name="billing_cycle" error={fieldErrors.billing_cycle}>
        {(a) => (
          <select
            name="billing_cycle"
            value={v.billing_cycle}
            onChange={set("billing_cycle")}
            className={selectClass}
            {...a}
          >
            {BILLING_CYCLES.map((c) => (
              <option key={c} value={c}>
                {CYCLE_LABELS[c]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {v.billing_cycle === "custom" && (
        <Field name="billing_interval" error={fieldErrors.billing_interval}>
          {(a) => (
            <Input
              name="billing_interval"
              inputMode="numeric"
              value={v.billing_interval}
              onChange={set("billing_interval")}
              {...a}
            />
          )}
        </Field>
      )}

      {trialMode ? (
        <input type="hidden" name="next_renewal_date" value={v.next_renewal_date} />
      ) : (
        <Field name="next_renewal_date" error={fieldErrors.next_renewal_date}>
          {(a) => (
            <Input
              name="next_renewal_date"
              type="date"
              value={v.next_renewal_date}
              onChange={onRenewal}
              {...a}
            />
          )}
        </Field>
      )}

      <Field
        name="stop_date"
        live
        error={fieldErrors.stop_date}
        help={
          <>
            <p>We suggest {defaultStopDays} days before renewal. You can change it.</p>
            {warnings.includes("stop_in_past") && (
              <p className="mt-1">This stop date has passed. No stop-date reminder will be sent.</p>
            )}
            {warnings.includes("stop_after_renewal") && (
              <p className="mt-1">
                This stop date is after the renewal. The card could be charged first.
              </p>
            )}
          </>
        }
      >
        {(a) => (
          <Input
            name="stop_date"
            type="date"
            value={v.stop_date}
            onChange={(e) => {
              stopTouched.current = true;
              set("stop_date")(e);
            }}
            {...a}
          />
        )}
      </Field>

      <Field name="category" error={fieldErrors.category}>
        {(a) => <Input name="category" value={v.category} onChange={set("category")} {...a} />}
      </Field>

      <Field name="payment_method_type" error={fieldErrors.payment_method_type}>
        {(a) => (
          <select
            name="payment_method_type"
            value={v.payment_method_type}
            onChange={set("payment_method_type")}
            className={selectClass}
            {...a}
          >
            {PAYMENT_LABELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        name="card_nickname"
        error={fieldErrors.card_nickname}
        help="Never enter card numbers. Use a nickname only, like 'Wise card for streaming'. We never need your real card."
      >
        {(a) => (
          <Input
            name="card_nickname"
            autoComplete="off"
            value={v.card_nickname}
            onChange={set("card_nickname")}
            {...a}
          />
        )}
      </Field>

      <Field name="cancel_url" error={fieldErrors.cancel_url}>
        {(a) => (
          <Input
            name="cancel_url"
            inputMode="url"
            autoComplete="off"
            value={v.cancel_url}
            onChange={set("cancel_url")}
            {...a}
          />
        )}
      </Field>

      <Field name="notes" error={fieldErrors.notes}>
        {(a) => (
          <textarea
            name="notes"
            rows={4}
            value={v.notes}
            onChange={set("notes")}
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground aria-invalid:border-destructive"
            {...a}
          />
        )}
      </Field>

      {trialMode ? (
        <input type="hidden" name="is_trial" value="on" />
      ) : (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="is_trial"
            className="flex min-h-11 items-center gap-3 text-sm font-medium"
          >
            <input
              id="is_trial"
              name="is_trial"
              type="checkbox"
              checked={v.is_trial}
              onChange={(e) => setV((p) => ({ ...p, is_trial: e.target.checked }))}
              className="size-5"
            />
            {FIELD_LABELS.is_trial}
          </label>
        </div>
      )}

      {v.is_trial && (
        <Field
          name="trial_end_date"
          label={labels.trial_end_date}
          error={fieldErrors.trial_end_date}
        >
          {(a) => (
            <Input
              name="trial_end_date"
              type="date"
              value={v.trial_end_date}
              onChange={trialMode ? onRenewal : set("trial_end_date")}
              {...a}
            />
          )}
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving..." : "Save"}
        </Button>
        <Link
          href="/app/subscriptions"
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium underline underline-offset-4"
        >
          Back to list
        </Link>
      </div>
    </form>
  );
}
