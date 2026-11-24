import { after } from "next/server";
import { trackEvent, type EventName, type EventsClient } from "./events";

/** Fire and forget: runs after the response. Safe to call anywhere; never throws. */
export function track(
  client: unknown,
  userId: string | null,
  name: EventName,
  props?: unknown,
): void {
  try {
    after(() => trackEvent(client as EventsClient, userId, name, props));
  } catch {
    // Outside a request (prerender or a test): skip the event.
  }
}
