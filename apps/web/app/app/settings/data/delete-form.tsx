"use client";

import { useActionState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { DeleteState } from "./actions";

export function DeleteForm({
  action,
}: {
  action: (prev: DeleteState, fd: FormData) => Promise<DeleteState>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const error = state.status === "error" ? state : null;
  return (
    <>
      <form action={formAction} className="mt-4 flex flex-col gap-4" aria-busy={pending}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="confirm">Type DELETE to confirm</Label>
          <Input id="confirm" name="confirm" autoComplete="off" required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="email">Your account email</Label>
          <Input id="email" name="email" type="email" autoComplete="off" required />
        </div>
        <div role="alert">
          {error && (
            <p className="flex items-start gap-1 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error.message}</span>
            </p>
          )}
        </div>
        <div>
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending && (
              <Loader2 className="size-4 animate-spin motion-reduce:hidden" aria-hidden="true" />
            )}
            {pending ? "Deleting..." : "Delete my account now"}
          </Button>
        </div>
      </form>
      {error?.code === "recent" && (
        <form action="/auth/signout" method="post" className="mt-4">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      )}
    </>
  );
}
