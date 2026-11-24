---
id: T-003
title: Auth: magic link and Google
status: BUILDING
milestone: MVP
ui: true
depends_on: [T-002]
completed:
fix_loops: 0
---

# T-003 Auth: magic link and Google

## Goal
Auth: magic link and Google. Planner refines this and writes Given/When/Then criteria before build.

## Acceptance criteria
- [ ] (Planner fills in)

## Plan (Planner)
Facts: Next 16.4.6 uses `apps/web/proxy.ts` (exports `proxy()` + `config.matcher`), not middleware.ts. AGENTS.md says read node_modules/next/dist/docs (01-app/02-guides/authentication.md, 03-file-conventions/proxy.md) before coding. @supabase/ssr is not installed: pin exact latest; confirm getClaims exists, else use getUser(). Check current createServerClient cookie API (getAll/setAll). handle_new_user trigger already creates profiles: no DB change.
Add (apps/web): lib/supabase/server.ts (createServerClient + next/headers cookies), lib/supabase/browser.ts (createBrowserClient), lib/supabase/proxy.ts updateSession(req)->{response,isAuthed} (getClaims), lib/auth-routes.ts (pure: safeNext, routeDecision, DEFAULT_AFTER_SIGN_IN="/app"), proxy.ts (updateSession then routeDecision; copy refreshed cookies onto redirects; matcher excludes static files), app/auth/callback/route.ts (GET), app/auth/signout/route.ts (POST only; GET 405), app/sign-in/page.tsx + sign-in-form.tsx (client), app/app/layout.tsx (header: BRAND, user email, sign-out POST form; also checks getClaims and redirects if no user: proxy is not the only gate), app/app/page.tsx (h1 "You are signed in" + email). Reuse Button/Input/Label, alert and sending patterns from waitlist-form.tsx, BRAND from @app/core. Do not add password flow, other providers, /login alias, custom rate limiting.
safeNext(raw): returns raw only if same-origin path: starts with "/", not "//", no backslash, no ":" before first "/", no control chars/whitespace, length<=200, decode once before checking, and is /app or /app/...; else "/app". routeDecision(pathname,search,isAuthed): /app or /app/** not authed -> redirect "/sign-in?next=<encoded safeNext(pathname+search)>"; /sign-in authed -> redirect "/app"; else next. Match by segment: "/application" not protected. Missing env vars: treat as not authed (never fail open).
Callback GET: query code,next,error. Success: exchangeCodeForSession(code), 303 to origin+safeNext(next). Failure/missing code/provider error: 303 to /sign-in?error=callback; do not leak error_description. Sign-out POST: signOut(), 303 to "/".
Form: signInWithOtp({email, options:{emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`, shouldCreateUser:true}}); signInWithOAuth({provider:"google", options:{redirectTo: same URL}}). Export pure helpers isEmail, mapAuthError(error)->"rate_limited"|"server" so they can be unit tested (.ts test files, not .tsx).
Copy: h1 "Sign in to {BRAND}"; lead "We email you a link. No password."; button "Send sign-in link"; divider "or"; "Continue with Google" (text only); note "No bank linking. We never store card numbers."; sent (role=status, live region present from first render): "Check your email. We sent a sign-in link to {email}. Open the link on this device. It works once and expires in 1 hour. Check spam if you do not see it." + "Use a different email" ghost button; invalid email inline error with aria-invalid and focus back; 429 "Too many tries. Please wait a few minutes and try again."; other "Something went wrong on our side. Your email was not sent. Please try again."; ?error=callback "That link did not work. It may have expired or been used already. Send a new link."; Google error "Google sign-in did not start. Try again or use an email link." Follow docs/design-system.md; no legal links yet (T-022).
config.toml: add [auth] site_url "http://localhost:3000", additional_redirect_urls [".../auth/callback"], enable_signup true; [auth.email] enable_signup, enable_confirmations true, otp_expiry 3600, max_frequency "60s"; [auth.external.google] enabled true, client_id/secret via env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID / _SECRET), skip_nonce_check false. Verify key names for CLI 3.3.0. Do NOT run supabase init over config.toml. .env.example: add NEXT_PUBLIC_SITE_URL (optional) and the two Google vars. Make sure supabase/.env is in .gitignore.
Root README.md (new) "Auth one-time setup": create Supabase project, copy URL+anon key to apps/web/.env.local; dashboard URL Configuration (site URL, redirect URLs incl. localhost and prod and optional Vercel preview pattern); email provider with Confirm email on, OTP expiry <=3600; Google Cloud OAuth client (Web; origin = site URL; redirect URI https://<ref>.supabase.co/auth/v1/callback; paste id+secret in dashboard, never commit); local CLI: Google vars in git-ignored supabase/.env; built-in SMTP is for testing only (few emails/hour) so set custom SMTP (Resend) before real users; magic links must open in the same browser (PKCE); same verified email links Google and magic-link identities. Link it from supabase/README.md.
Do not touch supabase/migrations, functions, or packages/core.
Criteria:
1. safeNext("/app/settings?tab=1") returns the same string.
2. safeNext for "//evil.com", "/\evil.com", "https://evil.com", "javascript:alert(1)", "/app
", "/%2f%2fevil.com", "/other", "", null, undefined returns "/app".
3. routeDecision no session "/app/x" "?a=1" -> redirect "/sign-in?next=%2Fapp%2Fx%3Fa%3D1".
4. No session on "/", "/privacy", "/terms", "/sign-in", "/auth/callback", "/api/waitlist", "/application" -> next.
5. Session on "/sign-in" -> redirect "/app"; session on "/app" -> next.
6. Callback with code and next=/app/x: exchangeCodeForSession(code) called; 303 to {origin}/app/x.
7. next=//evil.com -> redirect {origin}/app.
8. Exchange error or no code -> 303 /sign-in?error=callback.
9. POST signout: signOut called, 303 to "/"; GET 405.
10. updateSession: getClaims no user -> isAuthed false; user -> true; cookies set by the client end up on the response.
11. Form: invalid email -> inline error, aria-invalid, focus back, signInWithOtp not called (test via pure helpers + markup).
12. Valid email -> signInWithOtp once with emailRedirectTo ending /auth/callback?next=%2Fapp; sending state; then sent message.
13. 429 -> rate-limit message, value kept; other error -> server message.
14. Google click -> signInWithOAuth provider google, same redirectTo.
15. /sign-in?error=callback shows the "That link did not work" alert.
16-20 manual (need live Supabase): /app redirects to /sign-in?next=%2Fapp; magic link and Google land on /app with email; sign-out works; / loads without redirect; profile row exists (also tests the T-002 trigger).
Gate: typecheck, lint, format:check, test, build pass (build needs no env vars; missing env must not crash the build). Light+dark at 375 and 1024.
Tests mock @supabase/ssr and the server client; no real Supabase calls.
Reviewer required for this ticket (open redirect, cookies, no route fails open).

## Design (Designer)
## Build notes (Builder)
## Test report (Tester)
## Review verdict (Reviewer)
<!-- VERDICT: PASS | NEEDS_FIXES -->

## Developer sign-off
- [ ] Approved on:
