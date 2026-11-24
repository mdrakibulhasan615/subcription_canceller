# Design system (from T-020, Designer)

Style: minimal, calm slate neutrals, one teal accent. No gradients. Components use tokens only (no raw hex). Dark mode follows `prefers-color-scheme` (class `.dark` via media query). No toggle yet. Test light and dark on every screen.

## Color tokens (shadcn vars, map with `@theme inline`). Light -> Dark
- background #FFFFFF -> #0B1220; foreground #0F172A -> #F1F5F9
- card #FFFFFF -> #131C2E (card-foreground = foreground); popover = card
- primary #0F766E -> #2DD4BF; primary-foreground #FFFFFF -> #0B1220
- secondary #F1F5F9 -> #1E293B; secondary-foreground #0F172A -> #F1F5F9; accent = secondary
- muted #F1F5F9 -> #1E293B; muted-foreground #475569 -> #A3B1C6
- border #E2E8F0 -> #243349 (dividers only); input #64748B -> #64748B (control edge)
- ring #0F766E -> #2DD4BF
- destructive #B91C1C -> #FCA5A5; destructive-foreground #FFFFFF -> #450A0A
- notice-bg #FEF3C7 -> #2A2110; notice-fg #78350F -> #FDE68A; notice-border #B45309 -> #D97706; success-fg #14532D -> #BBF7D0

## Status badge vars `--status-{active|soon|stopped|merchant|error}-{bg|fg}` (light bg/fg -> dark bg/fg)
- Active (icon CircleCheck): #DCFCE7/#14532D -> #052E16/#BBF7D0
- Stopping soon (Clock): #FFEDD5/#7C2D12 -> #431407/#FED7AA
- Stopped (CirclePause): #E2E8F0/#334155 -> #1E293B/#CBD5E1
- Cancelled with merchant (BadgeCheck): #DBEAFE/#1E3A8A -> #172554/#BFDBFE. Exact label "Cancelled with merchant". Only after the user confirms. Plain "Cancelled" is never used.
- Error/failed (CircleAlert): #FEE2E2/#991B1B -> #450A0A/#FECACA
Badge: h-6, px-8, radius sm, 12px/600, 14px icon + text label ALWAYS. Wrap, do not truncate. Live changes go in role="status" with a full phrase.

## Type
System stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` in `--font-sans` (one variable, swap later). Mono `ui-monospace`. tabular-nums for dates and money.
Scale px (mobile / >=768): caption 12/16; small 14/20; body 16/24 (inputs never smaller); lead 18/28; h3 20/28; h2 24/32 / 30/36; h1 32/38 / 48/52. Weights 400 body, 500 labels/buttons, 600 headings. Headings: letter-spacing -0.01em, text-wrap balance. Text measure max 65ch.

## Spacing, radius, shadow
4px base. Section padding-y 48 / 96. Gutter 16 / 24 (md) / 32 (lg). Container max-w-5xl; text max-w-prose. Radius --radius 0.5rem: sm 4 (badge), md 8 (button, input), lg 12 (card, notice). No shadows except popovers `0 4px 12px rgb(15 23 42 / .12)` (none in dark). z: 0 / 10 sticky / 40 overlay / 100 toast. Breakpoints Tailwind default; check 375, 768, 1024, 1440; no horizontal scroll at 320; min-h-dvh.

## Components
- Button (cva): default primary; secondary; outline; ghost; destructive (red-700 bg, white text). Sizes: default h-11 px-16; sm h-9; lg h-12. Radius md, weight 500. Hover 90% opacity; active one shade darker, no layout change. Disabled opacity .5 + `disabled`. Loading: disabled + Loader2 spinner + "Sending..." with no width change. One primary button per view.
- Input: h-11, px-12, text-base, 1px --input border, radius md. Placeholder is never the label. Visible label above (14px/500, htmlFor). Helper text 14px muted, aria-describedby. Invalid: border destructive + aria-invalid + error text under the field with icon.
- Card: bg card, 1px border, radius lg, p-24 (p-16 dense), no shadow. Clickable card = one link, focus ring.
- Alert: shape of notice. Variants info (notice tokens), error (destructive text, 1px destructive border, CircleAlert), success (success tokens, CircleCheck).
- Focus: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }` on all interactive elements. Skip link first in tab order. Touch targets >= 44px.
- Icons: lucide-react only, 16/20/24, aria-hidden beside text, aria-label on icon-only buttons.

## Motion
--dur-fast 120ms, --dur-base 200ms, --dur-slow 300ms. Ease-out `cubic-bezier(0.2,0,0,1)`. Animate opacity, color, transform only. Max 1 to 2 animated items per view. Reduced motion: `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important } }`; spinner becomes static text "Sending...".

## Rules for all UI tickets
One h1 per page; h2 -> h3 in order. Forms: visible label, error below field linked by aria-describedby, aria-live for async status, disabled button while sending; multi-error forms get a focusable error summary at the top. Copy: plain short English. Never "cancelled" for our own action. Say "Payments stop on the date you set". Empty state: one sentence + one button. Loading over 1s: skeleton (no shimmer under reduced motion). Run axe in T-025.

## Landing page layout (T-020)
Skip link; header with BRAND wordmark (text); main#main: hero (one h1 e.g. "Know when to stop paying.", lead "Payments stop on the date you set. {BRAND} reminds you to freeze or close your card a few days before renewal.", the form right under, small note "No bank linking. We never store card numbers."); "How it works" h2 with 4 step cards (1 col, 2x2 at md, 4 cols at lg; number in 32px circle; steps: add subscription, set stop date, get reminders, freeze the card yourself; step 4 is a normal card); honesty notice (aside, notice tokens, 4px left border, Info icon + h2 "Please read this" + the exact copy from the ticket, max 65ch, calm amber not red); footer with BRAND (links to legal pages added by T-022).
Waitlist form: mobile stacked full width; md+ input and button in one row; helper "One email when we open. No spam. No bank linking." States: idle; sending (input readOnly, button disabled + spinner + "Sending...", aria-busy); success (alert in the aria-live region present from first render; same message for new, duplicate and honeypot; no focus move; fade-in 4px translate); invalid email (inline error "Enter a valid email address, like name@example.com.", aria-invalid, validate on submit and blur, focus back to input); 429 ("Too many tries. Please wait a few minutes and try again."); 500/network ("Something went wrong on our side. Your email was not saved. Please try again."), value kept.
