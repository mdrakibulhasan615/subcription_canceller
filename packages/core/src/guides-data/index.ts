// One import per file. A new guide file needs one line here (guides-data.test.ts fails if it is missing).
import cancelNetflix from "./cancel--netflix.json";

export const GUIDE_FILES: Record<string, unknown> = {
  "cancel--netflix.json": cancelNetflix,
};
