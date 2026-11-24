# Guide verification checklist

All guides ship with `last_checked_at: null`. The stale badge shows until you set a date.

For each row:

1. Open the official source URL. Follow the steps in the guide with a real account.
2. Fix wrong names or steps in `packages/core/src/guides-data/<kind>--<slug>.json`.
3. Check that `url`, `source_url` and every step `link` open.
4. Set `last_checked_at` to today (`YYYY-MM-DD`).
5. After all edits, run `pnpm seed:guides`.

| Guide file                       | Official source URL                                                                                      | What to verify                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| cancel--netflix                  | https://help.netflix.com/en/node/407                                                                     | Account > Membership > Cancel membership names.                                                            |
| cancel--spotify                  | https://support.spotify.com/article/cancel-premium/                                                      | Account > Manage your plan > Cancel Premium.                                                               |
| cancel--youtube-premium          | https://support.google.com/youtube/answer/6308278                                                        | Purchases and memberships > Manage membership > Deactivate.                                                |
| cancel--disney-plus              | https://help.disneyplus.com/article/disneyplus-en-us-cancel-subscription                                 | Account > Subscription > Cancel Subscription.                                                              |
| cancel--amazon-prime             | https://www.amazon.com/gp/help/customer/display.html?nodeId=GTJQ7QZY7QL2HK46                             | Not fetched (Amazon blocked the request). Confirm the source URL is the right help page. Check End Membership steps. |
| cancel--adobe-creative-cloud     | https://helpx.adobe.com/manage-account/using/cancel-subscription.html                                    | Plans > Manage plan > Cancel your plan. Early cancel fee note.                                             |
| cancel--microsoft-365            | https://support.microsoft.com/en-us/microsoft-365                                                        | Source is a general landing page. Replace it with the exact cancel article. Check Services & subscriptions steps. |
| cancel--chatgpt-plus             | https://help.openai.com/en/articles/7232927-how-do-i-cancel-my-subscription-for-chatgpt-plus-or-chatgpt-pro | Profile menu > My plan > Manage subscription. Check the `url` goes to a useful page.                     |
| store--apple-app-store           | https://support.apple.com/en-us/118428                                                                   | Not fetched (rate limited). Check the article id, the iPhone and Mac steps, and the `url` (support.apple.com/billing). |
| store--google-play               | https://support.google.com/googleplay/answer/7018481                                                     | Profile > Payments & subscriptions > Subscriptions. Check the web link.                                    |
| provider--wise                   | https://wise.com/help                                                                                    | Source is the general help page. Replace it with the card articles. Check Freeze card and Delete card names. |

Only HTTP status was checked for the source pages. Step text comes from general knowledge, not from page content.
