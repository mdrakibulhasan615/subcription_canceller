"use client";

import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "../../components/ui/button";
import { answerCardInterest } from "./card-interest-actions";

export function CardInterest() {
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (done) live.current?.focus();
  }, [done]);

  async function onSubmit(fd: FormData) {
    const r = await answerCardInterest(fd);
    if (r.ok) setDone(true);
    else setError(r.message);
  }

  if (hidden) return null;
  return (
    <section className="mt-8 max-w-prose rounded-lg border border-border bg-card p-4 text-card-foreground">
      <p ref={live} tabIndex={-1} aria-live="polite" className="outline-offset-2">
        {done ? "Thanks, saved." : ""}
      </p>
      {!done && (
        <form action={onSubmit}>
          <fieldset>
            <legend className="text-xl font-semibold">
              Would you want the card to close automatically?
            </legend>
            <p className="mt-2 text-muted-foreground">
              We are testing whether this would be useful. Nothing is charged or created.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="submit" name="answer" value="yes" className="min-h-11">
                Yes
              </Button>
              <Button
                type="submit"
                name="answer"
                value="maybe"
                variant="outline"
                className="min-h-11"
              >
                Not sure
              </Button>
              <Button type="submit" name="answer" value="no" variant="outline" className="min-h-11">
                No
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setHidden(true)}
              >
                Not now
              </Button>
            </div>
          </fieldset>
          <div role="alert">
            {error && (
              <p className="mt-3 flex items-start gap-1 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
