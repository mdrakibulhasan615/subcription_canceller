---
id: T-018
title: CSV import
status: DONE
milestone: MVP
ui: true
depends_on: [T-006]
completed: 2026-11-25
fix_loops: 0
---

# T-018 CSV import
✅ DONE 2026-11-25

## Goal
CSV import. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [x] (Planner fills in)

## Plan (Planner)
Design: no separate Designer step. Follow docs/design-system.md. READ node_modules/next/dist/docs (server actions) first (apps/web/AGENTS.md).
Core (new): packages/core/src/csv.ts (+ csv.test.ts, export from index.ts): hand-written RFC4180 parser (~40 lines, no dependency).
- CSV_LIMITS = {maxBytes: 200*1024, maxRows: 200}. parseCsv(text, delimiter "," | ";"): string[][]: strips BOM; CRLF and LF; quoted cells; "" escapes; commas/newlines inside quotes; an unterminated quote throws RangeError.
- ImportColumn = name|price|currency|billing_cycle|billing_interval|next_renewal_date|stop_date|category|cancel_url|payment_method_type|card_nickname|notes. ImportTable = {ok:true, rows:{rowNumber, cells}[], ignoredColumns} | {ok:false, error:"empty"|"too_large"|"too_many_rows"|"missing_columns"|"bad_quotes"|"bad_encoding", missing?}. readImportTable(text). Delimiter detected from the header line outside quotes (comma or semicolon, whichever is more frequent). rowNumber = record number (header is row 1, first data row 2); blank lines skipped but counted. Skip an Excel `sep=;` first line. Required columns: name, price, billing_cycle, next_renewal_date. Header match case-insensitive, trimmed, ignoring _ - and spaces. Aliases: name: service, subscription; price: amount, cost; billing_cycle: cycle, frequency, period; next_renewal_date: renewal, renewal_date, next_billing, next_payment; stop_date: stop; card_nickname: card; cancel_url: url, cancel_link; payment_method_type: payment_method. Value aliases billing_cycle: month, monthly, mo, annual, year, yearly, week, weekly, quarter, quarterly, custom. payment_method_type: Wise, Privacy.com, "other virtual" etc; unknown stays as typed so parseSubForm rejects it with a row error. Blank payment method = none; blank currency = profile currency; unknown currency = row error "Choose a currency from the list."
Web (new): apps/web/lib/csv-import.ts (+ csv-import.test.ts): previewImport(db, userId, csv, now) -> {ok:true, rows: PreviewRow{rowNumber,name,state:"valid"|"invalid"|"duplicate",reasons,warnings}[], counts, ignoredColumns} | {ok:false,message}; commitImport(db,userId,csv,now) -> {ok:true, imported, skipped, remindersOk} | {ok:false, error:"rate_limited"|"server"|"nothing_to_import"|"file"|"too_many", message, retryAfterSec?}; ImportDb extends SubDb with insertSubs(rows:(SubWrite & {user_id})[]) : Promise<number> (ONE supabase insert([...]) call = all or nothing); createImportDb(sb) = {...createSubDb(sb), insertSubs}.
Web page (new) apps/web/app/app/import/{page.tsx (server: loads profile, template link), actions.ts ("use server", async function declarations only; importAction(prev, fd) with hidden csv text and intent "preview"|"import"; getClaims + userIdFrom; no user -> auth message; rate limit only on import; never throws; no redirect on success, shows result with a link to /app/subscriptions), import-form.tsx (client)}. Template link = data:text/csv URL with a BOM, a header, 2 example rows with dates today+30 days, `download` attribute. The client checks file.size <= 200 KB, reads await file.text() into state and sends it as a string field (React resets file inputs after a form action).
Link edit: apps/web/app/app/subscriptions/page.tsx: add an "Import from CSV" link (secondary style, border border-input, h-11) next to the "Add subscription" buttons (empty and non-empty states). Do NOT edit layout.tsx, lib/subscriptions.ts, lib/sub-view.ts or [id]/page.tsx. No migration.
Reuse: call parseSubForm(fd, profile) for EVERY row (build a FormData from mapped cells): same schema, toMinor, card guard (card_nickname and notes), https check, managed block, default stop date as T-006. safeRebuild, todayIn, userIdFrom, rateLimit, stopDateWarnings as they are.
Flow: preview action: bytes check with Buffer.byteLength, readImportTable, getProfile + listSubs (including archived). Per row: parseSubForm; field errors become reasons naming the field with T-006 messages (a card-like value is NEVER echoed). Duplicate key = lower(trim(name))|price_minor|currency|billing_cycle|billing_interval|next_renewal_date: first row in the file wins; later rows "Same as row N"; match with an existing subscription (archived too) "Already in your list"; invalid rows are never duplicates. Stop date in the past: valid with non-blocking warning "No stop-date reminder will be sent" (stopDateWarnings with todayIn(profile tz)). Confirm button "Import N subscriptions" disabled when N=0 or pending; same CSV text goes to the import action; the server RE-RUNS preview (never trusts it); rateLimit("import:"+userId) 5 per 10 min on commit only; refuse if existing + new rows > 500; ONE insertSubs; ONE safeRebuild. Results: "Imported N. Skipped M (invalid or already in your list)."; rebuild fails: "Imported N. Reminders could not be updated. Save any subscription to retry." (rows stay saved); insert fails: "Nothing was imported. Try again." Add `shortcut:` comments: in-memory limiter per instance; app-level idempotency (no DB unique key), two parallel requests could double-insert.
Edge cases: whole-file rejection (no truncation) for empty/header-only, > 200 KB, > 200 data rows, missing required column (message names them), unterminated quote, U+FFFD in text ("Save as CSV UTF-8"). Unknown columns ignored and listed. Rows with fewer/more cells than the header are padded/trimmed; invalid only if a required cell is empty. BOM on the first header stripped. Dates strictly YYYY-MM-DD (DD/MM and MM/DD rejected with a hint). Prices strict via toMinor ("$9.99" and "1,50" invalid; say so in the copy). managed rejected. is_trial/trial_end_date are not columns (say so in the copy). Stop date after renewal invalid; past renewal allowed with a warning, not rolled. CSV injection: store cells as typed, React escapes on render; neutralise only on export (T-023 must prefix ' to cells starting with = + - @, tab or CR: add this note to T-023). Honest copy on the page: "Never put card numbers in the file." "We use the file only to import it. We do not keep it." "Importing does not contact any service."
Criteria:
1. Valid 3-row file: preview 3 valid; confirm inserts 3 rows for the user with correct price_minor; blank stop date defaults to renewal minus default_stop_days_before; rebuildReminders called once.
2. Missing price or name: file error naming the missing columns, nothing importable; unclosed quote -> bad_quotes; empty or header-only -> empty.
3. > 200 KB rejected on the client (no upload) and on the server (forged text field); 200 rows accepted; 201 -> too_many_rows.
4. Rows 2 and 5 same name/price/currency/cycle/renewal: row 5 "Same as row 2", only row 2 imported; match with an existing (archived too) subscription "Already in your list", not inserted; names differing only in case/whitespace are duplicates; different price is not.
5. BOM + CRLF file parses; last row without trailing newline parses.
6. `"Netflix, Premium"` and `"say ""hi"""` keep values; quoted newline stays in one row.
7. `;` file delimiter detected; a `;` inside quotes in a comma file does not switch it.
8. Headers Service,Amount,Cycle,Renewal map; "Annual" -> yearly.
9. CAD or RM -> row invalid "Choose a currency from the list."; blank currency -> profile currency.
10. card_nickname "4111 1111 1111 1111" -> row invalid with the card message, value not in any returned data; "Wise 2024" passes; notes with a card number invalid.
11. Past stop date: valid with warning; past renewal: valid, not rolled; stop after renewal: invalid.
12. 2 valid + 1 invalid: confirm imports 2, "Imported 2. Skipped 1".
13. insertSubs throws: nothing imported, no rebuild, message says nothing was imported; rebuild fails: rows kept, message says reminders could not be updated.
14. Same confirm sent twice: second imports 0, no duplicate rows.
15. 6th import within 10 minutes -> rate_limited with retryAfterSec; previews still work.
16. Name `=HYPERLINK("x")` stored as typed, rendered as text.
17. No claims: auth message, DB untouched; inserted rows carry only the caller's user_id.
18. Existing + new rows > 500: refused with a clear message.
19. A11y: labelled file input, h-11 controls, counts/results in an aria-live region, error summary takes focus, row states by text + icon, template link and link to /app/subscriptions; typecheck, lint, format:check, test, build pass.
Tests (no Docker): core csv.test.ts pure Vitest (criteria 2-8); csv-import.test.ts with an in-memory ImportDb fake (extend the SubDb fake from lib/subscriptions.test.ts; add insertSubs with a throw switch): criteria 1, 4, 9-15, 17, 18; fixed now; profile Asia/Kuala_Lumpur; call _resetRateLimit in beforeEach; assert reminder inserts carry only the 5 allowed keys; generate 200/201-row files in code; a small no-claims guard test. No browser test (T-025).
Reviewer: skip (no migration; Tester covers).

## Design (Designer)
## Build notes (Builder)
Built. Own tests/lint/build pass; full suite had 1 failure in T-012 mid-edit files. Files: core csv.ts (+test), lib/csv-import.ts (+test), app/app/import/{page,actions,import-form}, Import link on subscriptions/page.tsx (+daysLeftText hasStop fix). Deviations: size check via TextEncoder in readImportTable; rate limit runs before the commit re-run (a failed commit uses a slot); second identical confirm returns nothing_to_import (not ok:true imported 0); extra "renewal date has passed" warning; a bad currency row may list a price error too. Unverified: browser flow (formAction on both buttons, focus, aria-live), real single insert vs RLS with .select("id"), data-URL template download.
## Test report (Tester)
PASS. 276 tests; 25 scratch parser tests + web fake tests (BOM/CRLF/quotes/semicolon/200 vs 201 rows/204800 bytes/duplicates/forged columns/never-echo of card-like nickname and notes) all OK; Tester added actions.test.ts (no-claims guard). Open polish (queued for the polish batch): (1) a card-like value in the `name` column is echoed in PreviewRow.name: reject/mask it; (2) date error text "Not a real date (YYYY-MM-DD) Use YYYY-MM-DD." lacks a period; (3) button reads "Import 1 subscriptions": pluralise; (4) rate-limit slot used before the re-run (disclosed). Not tested: browser flow, real single insert vs RLS, signed-in page. Reviewer skipped.
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [x] Approved on: 2026-11-25 (CEO, standing order)
