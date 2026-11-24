"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CSV_LIMITS } from "@app/core";
import { CircleAlert, CircleCheck, Clock, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { resultMessage, type ImportState } from "../../../lib/csv-import";

type Action = (prev: ImportState, fd: FormData) => Promise<ImportState>;

const STATE_LABEL = { valid: "Will import", invalid: "Has errors", duplicate: "Skipped" } as const;

export function ImportForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(action, {
    status: "idle",
  });
  const [csv, setCsv] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  // The preview is for the file as it was when checked. A new file hides it.
  const [stale, setStale] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const message = fileError ?? (state.status === "error" ? state.message : null);

  useEffect(() => {
    if (message) summaryRef.current?.focus();
  }, [message, state]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setStale(true);
    setCsv("");
    setFileError(null);
    if (!file) return;
    if (file.size > CSV_LIMITS.maxBytes) {
      setFileError("The file is larger than 200 KB. Split it into smaller files.");
      return;
    }
    try {
      setCsv(await file.text());
    } catch {
      setFileError("The file could not be read. Choose it again.");
    }
  }

  // React resets file inputs after an action, so the text goes in as a string field.
  const run = (intent: "preview" | "import") => (fd: FormData) => {
    fd.set("csv", csv);
    fd.set("intent", intent);
    setStale(false);
    formAction(fd);
  };
  const preview = state.status === "preview" && !stale ? state.preview : null;
  const done = state.status === "done" && !stale ? state.result : null;

  return (
    <form action={run("preview")} noValidate className="mt-8 flex max-w-prose flex-col gap-6">
      <div
        ref={summaryRef}
        tabIndex={-1}
        hidden={!message}
        className="rounded-lg border border-destructive p-4 text-destructive"
      >
        {message && (
          <p className="flex items-start gap-2 font-semibold">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="file">CSV file (up to 200 KB)</Label>
        <input
          id="file"
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          aria-describedby="file-help"
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
        />
        <p id="file-help" className="text-sm text-muted-foreground">
          Save the file as CSV UTF-8. We check it first. Nothing is saved until you confirm.
        </p>
      </div>

      <div>
        <Button type="submit" disabled={pending || !csv} aria-busy={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Checking..." : "Check file"}
        </Button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-4">
        {done && (
          <div className="rounded-lg border border-border p-4">
            <p className="flex items-start gap-2 font-semibold">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {resultMessage(done)}
            </p>
            <Link
              href="/app/subscriptions"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Go to your subscriptions
            </Link>
          </div>
        )}
        {preview && (
          <>
            <p className="font-semibold">
              {preview.counts.valid} ready, {preview.counts.invalid} with errors,{" "}
              {preview.counts.duplicate} skipped as duplicates.
            </p>
            {preview.ignoredColumns.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Ignored columns: {preview.ignoredColumns.join(", ")}.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {preview.rows.map((r) => (
                <li key={r.rowNumber} className="rounded-lg border border-border p-3 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium [overflow-wrap:anywhere]">
                    {r.state === "valid" ? (
                      <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                    ) : r.state === "invalid" ? (
                      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Clock className="size-4 shrink-0" aria-hidden="true" />
                    )}
                    Row {r.rowNumber}: {r.name || "(no name)"} ({STATE_LABEL[r.state]})
                  </p>
                  {[...r.reasons, ...r.warnings].map((t) => (
                    <p key={t} className="mt-1 text-muted-foreground">
                      {t}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <div>
              <Button
                type="submit"
                formAction={run("import")}
                disabled={pending || preview.counts.valid === 0}
                aria-busy={pending}
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {pending ? "Importing..." : `Import ${preview.counts.valid} subscriptions`}
              </Button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
