# StopDate

Privacy-first subscription manager. See `PLAN_OVERVIEW.md`. Commands: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.

## Auth one-time setup

Do this once per Supabase project. Never commit secrets.

1. Create a Supabase project. Copy the project URL and the anon key into `apps/web/.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In the dashboard, open Authentication, URL Configuration:
   - Site URL: your production URL.
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<production-domain>/auth/callback`, and (optional) a Vercel preview pattern such as `https://*-<team>.vercel.app/auth/callback`.
3. In Authentication, Providers, Email: turn on Confirm email. Set OTP expiry to 3600 seconds or less.
4. Google: in Google Cloud, create an OAuth client of type Web.
   - Authorized JavaScript origin: the site URL.
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
   - Paste the client ID and secret into the Supabase dashboard (Providers, Google). Do not commit them.
5. Local CLI: put `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in `supabase/.env`. This file is git-ignored.
6. Email: the built-in Supabase SMTP is for testing only (a few emails per hour). Set custom SMTP (Resend) before real users sign in.

Good to know:

- A magic link must open in the same browser that asked for it (PKCE).
- The same verified email links the Google identity and the magic-link identity to one user.
