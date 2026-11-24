"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "../../../components/ui/input";

/** Timezone text input. Fills the browser zone when the saved zone is still "UTC". */
export function TzInput({
  initial,
  describedBy,
  invalid,
}: {
  initial: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [zones, setZones] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setZones(Intl.supportedValuesOf("timeZone"));
      const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (initial === "UTC" && here && here !== "UTC" && ref.current) ref.current.value = here;
    } catch {
      // Old browser: the text input still works.
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initial]);
  return (
    <>
      <Input
        ref={ref}
        id="timezone"
        name="timezone"
        list="timezone-list"
        autoComplete="off"
        defaultValue={initial}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      />
      <datalist id="timezone-list">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </>
  );
}
