"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Info, Loader2 } from "lucide-react";
import { Button } from "../../../../../components/ui/button";
import { archiveSub, deleteSub, unarchiveSub } from "../../actions";
import type { ActionResult } from "../../form-utils";

export function RowActions({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (id: string) => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn(id);
      setError(r.ok ? null : r.message);
      if (r.ok) setConfirming(false);
    });

  return (
    <section aria-label="Archive or delete" className="mt-6 flex max-w-prose flex-col gap-3">
      {archived && (
        <p className="flex items-center gap-2 rounded-lg border border-notice-border bg-notice-bg p-3 text-notice-fg">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          Archived. Its reminders are off.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(archived ? unarchiveSub : archiveSub)}
        >
          {pending && !confirming && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {archived ? "Unarchive" : "Archive"}
        </Button>
        {!confirming && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        )}
      </div>
      {confirming && (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          className="rounded-lg border border-destructive p-4"
        >
          <p>Delete {name}? This cannot be undone. Its reminders are deleted too.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(deleteSub)}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      <p role="status" className="flex items-center gap-2 text-sm text-destructive">
        {error && (
          <>
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </>
        )}
      </p>
    </section>
  );
}
