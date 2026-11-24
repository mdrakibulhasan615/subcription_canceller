import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry";

if (sentryOptions.dsn) {
  try {
    Sentry.init(sentryOptions);
  } catch {
    // A bad DSN must not stop the app.
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
