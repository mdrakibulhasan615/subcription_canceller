# Metrics

Five MVP metrics. Four come from existing tables. Only retention needs the `events` table. Run each file in `supabase/metrics/` in the Supabase SQL editor. Each file prints one row: numerator, denominator, percent.

| Metric | File | Definition | Target |
| --- | --- | --- | --- |
| Activation | `activation.sql` | Users with 3 or more subscriptions, divided by all users. | 50% |
| Stop dates | `stop_dates.sql` | Subscriptions with a stop date, divided by all subscriptions. | 40% |
| Reminder value | `reminder_value.sql` | Users with a stopped or merchant-cancelled subscription, divided by users with at least one reminder sent. | 30% |
| Card interest | `card_interest.sql` | Answers "yes" to the card question, divided by all answers. Also shows the "maybe" and "no" counts. | 40% |
| Retention (week 4) | `retention.sql` | Users with an `app_opened` event in week 4 (day 1 = sign-up day, week 4 = days 22 to 28), divided by users who signed up at least 28 days ago. | 25% |

## Caveats

- Activation: deleted subscriptions are not counted.
- Reminder value: this is a proxy. It does not prove that a reminder caused the stop. The events `subscription_stop_confirmed` and `merchant_cancelled_marked` are only a cross-check.
- Retention: deleted users have no user id, so they drop out (survivor bias). With about 20 users the numbers are noisy.
- Events are sent after the response. A failed insert is dropped. Counts can be slightly low.
- One `app_opened` event per user per UTC day. A second one the same day is rejected by a unique index.

## Events

Events never hold an email, name, price, card detail or note. Only fixed names, flags and small numbers.

- `signed_in_first`: first sign-in (the one-shot onboarding flag was set).
- `onboarding_completed`: the user saved onboarding step 2.
- `onboarding_skipped`: reserved. Not sent yet: the skip links are plain links.
- `subscription_added`: props `has_stop_date`, `is_trial`, `payment_method_type`, `source`.
- `subscription_stop_confirmed`: the user marked a subscription as stopped.
- `merchant_cancelled_marked`: the user marked a subscription as cancelled with the merchant.
- `stop_date_extended`: the user moved a stop date.
- `csv_imported`: prop `count`. One event per import.
- `export_downloaded`: prop `format` (`json` or `csv`).
- `account_deleted`: no user id.
- `waitlist_joined`: no user id.
- `app_opened`: the user opened the app area.

## How to run

1. Open the Supabase dashboard, then SQL editor.
2. Paste one file from `supabase/metrics/` and run it.
3. Read numerator, denominator and percent. Compare with the target.
