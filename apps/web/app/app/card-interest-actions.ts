"use server";

import { isAnswer, saveInterest, type FeedbackDb } from "../../lib/card-interest";
import { createClient, getClaims } from "../../lib/supabase/server";
import { userIdFrom } from "../../lib/subscriptions";

export type CardResult = { ok: true } | { ok: false; message: string };

export async function answerCardInterest(formData: FormData): Promise<CardResult> {
  const userId = userIdFrom(await getClaims());
  if (!userId) return { ok: false, message: "Sign in to answer." };
  const answer = formData.get("answer");
  if (!isAnswer(answer)) return { ok: false, message: "Choose Yes, Not sure or No." };
  try {
    await saveInterest((await createClient()) as unknown as FeedbackDb, userId, answer);
    return { ok: true };
  } catch {
    return { ok: false, message: "Something went wrong. Your answer was not saved. Try again." };
  }
}
