"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import type { ActionResult } from "../form-utils";
import {
  extendStopAction,
  markCancelledAction,
  markStoppedAction,
  unmarkCancelledAction,
  unmarkStoppedAction,
} from "./actions";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (iso: string) =>
  ISO.test(iso)
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : iso;
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Runs a server action. Success sets a status text, failure sets an alert text. */
function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const run = (fn: () => Promise<ActionResult>, ok: string, after?: () => void) =>
    start(async () => {
      let r: ActionResult;
      try {
        r = await fn();
      } catch {
        r = { ok: false, message: "Something went wrong. Please try again." };
      }
      setError(r.ok ? null : r.message);
      setDone(r.ok ? ok : "");
      if (r.ok) after?.();
    });
  return { pending, error, done, run };
}

function Result({ error, done }: { error: string | null; done: string }) {
  return (
    <>
      <p role="status" className="text-sm text-success-fg">
        {done}
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </>
  );
}

const Spin = ({ on }: { on: boolean }) =>
  on ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null;
const wrap = "h-auto min-h-11 py-2 whitespace-normal";

export function ReminderActions({
  id,
  stoppedText,
  cancelled,
  stopDate,
  renewal,
  today,
}: {
  id: string;
  /** "Marked as stopped on <date>", or null when not stopped. */
  stoppedText: string | null;
  cancelled: boolean;
  stopDate: string | null;
  renewal: string | null;
  today: string;
}) {
  const { pending, error, done, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  const [date, setDate] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const undo = useRef<HTMLButtonElement>(null);
  const focusUndo = useRef(false);
  // The confirm box is gone after "Yes". Send focus to Undo once the stopped text shows.
  useEffect(() => {
    if (stoppedText && focusUndo.current) {
      focusUndo.current = false;
      undo.current?.focus();
    }
  }, [stoppedText]);
  const base = stopDate && stopDate > today ? stopDate : today;
  const tooLate = (n: number) => !renewal || addDays(base, n) > renewal;
  const closeConfirm = () => {
    setConfirming(false);
    setTimeout(() => trigger.current?.focus());
  };
  const extend = (d: string) =>
    run(
      () => {
        const fd = new FormData();
        fd.set("stop_date", d);
        return extendStopAction(id, fd);
      },
      `Stop date moved to ${fmt(d)}. Reminders updated.`,
    );

  return (
    <div className="mt-2 flex max-w-prose flex-col gap-4">
      {stoppedText ? (
        <div className="flex flex-wrap items-center gap-3">
          <p>{stoppedText}</p>
          <Button
            ref={undo}
            type="button"
            variant="outline"
            disabled={pending}
            aria-label="Undo marked as stopped"
            onClick={() => run(() => unmarkStoppedAction(id), "Stopped mark removed.")}
          >
            <Spin on={pending} />
            Undo
          </Button>
        </div>
      ) : confirming ? (
        <div
          role="alertdialog"
          aria-label="Confirm marking as stopped"
          className="rounded-lg border border-input p-4"
          onKeyDown={(e) => e.key === "Escape" && closeConfirm()}
        >
          <p>
            This marks the subscription as stopped in StopDate. It does not cancel the subscription
            with the merchant. The merchant can still try to charge you if you did not cancel there.
            We stop sending reminders for it.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              type="button"
              autoFocus
              disabled={pending}
              className={wrap}
              onClick={() =>
                run(
                  () => markStoppedAction(id),
                  "Marked as stopped. Reminders are off.",
                  () => {
                    focusUndo.current = true;
                    setConfirming(false);
                  },
                )
              }
            >
              <Spin on={pending} />
              Yes, mark as stopped
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className={wrap}
              onClick={closeConfirm}
            >
              Not yet
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            ref={trigger}
            type="button"
            variant="outline"
            disabled={pending}
            className={wrap}
            onClick={() => setConfirming(true)}
          >
            I froze or closed my card
          </Button>
        </div>
      )}

      {!stoppedText && !cancelled && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            extend(date);
          }}
        >
          <label htmlFor="new-stop-date" className="text-sm font-medium">
            New stop date
          </label>
          <p id="new-stop-hint" className="text-sm text-muted-foreground">
            {renewal
              ? `Must be on or before your renewal date (${fmt(renewal)}).`
              : "Set a renewal date first. Use Edit."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="new-stop-date"
              type="date"
              required
              value={date}
              min={today}
              max={renewal ?? undefined}
              onChange={(e) => setDate(e.target.value)}
              aria-describedby="new-stop-hint"
              className="h-11 rounded-md border border-input bg-background px-3 text-base"
            />
            <Button type="submit" variant="outline" disabled={pending || !renewal}>
              <Spin on={pending} />
              Move stop date
            </Button>
            {[1, 3].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                disabled={pending || tooLate(n)}
                onClick={() => extend(addDays(base, n))}
              >
                +{n} {n === 1 ? "day" : "days"}
              </Button>
            ))}
          </div>
        </form>
      )}
      <Result error={error} done={done} />
    </div>
  );
}

export function MerchantControl({
  id,
  cancelledText,
}: {
  id: string;
  /** "Marked as cancelled with merchant on <date>", or null. */
  cancelledText: string | null;
}) {
  const { pending, error, done, run } = useRun();
  return (
    <div className="mt-1 flex max-w-prose flex-col gap-2">
      {cancelledText && <p>{cancelledText}</p>}
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className={wrap}
          aria-label={cancelledText ? "Undo marked as cancelled with merchant" : undefined}
          onClick={() =>
            cancelledText
              ? run(() => unmarkCancelledAction(id), "Merchant mark removed.")
              : run(() => markCancelledAction(id), "Marked as cancelled with merchant.")
          }
        >
          <Spin on={pending} />
          {cancelledText ? "Undo" : "I cancelled with the merchant"}
        </Button>
      </div>
      <Result error={error} done={done} />
    </div>
  );
}
