import * as React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
