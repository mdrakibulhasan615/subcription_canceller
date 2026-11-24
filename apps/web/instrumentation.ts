import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry";

export function register() {
  if (!sentryOptions.dsn) return;
  try {
    Sentry.init(sentryOptions);
  } catch {
    // A bad DSN must not stop the app.
  }
}

export const onRequestError = Sentry.captureRequestError;
