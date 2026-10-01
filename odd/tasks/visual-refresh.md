# Feature: visual-refresh

## Objective
Align the public landing page with the new brand identity (navy + gold isotype and wordmark merged in PR #38). Phase 1 covers the design system foundation: brand color tokens, one button system, and a deliberate section background rhythm. Later phases (hero redesign, imagery, services grid) are out of scope here.

## Problem / Why
- `app/globals.css` still declares the old brand tokens (`--brand-orange #F1AD32`, `--brand-blue #2563EB`); sections ignore them and hardcode blue-600, purple gradients, rainbow category colors and pastel backgrounds.
- Seven different section backgrounds (white, navy, mint, cream, lilac, gray, beige) and four primary-button styles (black pill, flat blue, purple gradient, white) on one page.
- Eyebrow labels and heading weights differ per section.
- The result reads as a template, not as the brand the logo now communicates.

## Scope (Phase 1)
- T1: brand tokens + button system + header/footer/hero on the new palette.
- T2: sections on the new rhythm and palette (security-social, why-choose-us, services + service-card, benefits, testimonials, process, about, faq, contact).
- T3: visual verification (desktop + 390px), tests, PR.

Out of scope: hero layout redesign, replacing illustrations/photos, services grid restructure, dashboard UI.

## Design decisions (accepted by the user on 2026-09-30)
- Palette: navy `#012A61` (primary surfaces/headings on light), gold `#E0A025` (accent, primary CTA), neutral grays. No purple/green/red/orange gradients, no rainbow per-card colors.
- Section rhythm: only three backgrounds, alternated with intention: white, light neutral (`gray-50`-ish, token `--surface-muted`), navy. Pastel mint/cream/lilac/beige go away.
- Buttons: `brand` (gold bg, navy text) as the single primary CTA; `brand-outline` (navy border/text on light, white border/text on navy) as secondary. Black pills and gradient buttons are replaced.
- Typography: Figtree bold for H1/H2 (`font-figtree font-bold`), Inter for body. One shared `SectionLabel` eyebrow component.
- Gradient text headings are replaced by solid navy (on light) or white with a gold-highlighted word (on navy).

## Constraints
- English code/comments; Spanish UI copy unchanged (content is not part of this phase).
- Keep component structure, props, animations and content; this is a styling pass.
- Tailwind v4 (`@theme inline` in globals.css, no tailwind.config). New tokens are exposed as `--color-brand-*` so `bg-brand-navy`, `text-brand-gold` etc. work.
- Do not touch dashboard styles (`components/dashboard`, `app/dashboard`).

## TDD
- Mode: off (no configuration enables it). Runner: `pnpm test -- --run` (vitest).

## Checks
- `npx tsc --noEmit -p . 2>&1 | rg -c "error TS"` must stay at 38 (pre-existing baseline on master bc2174f).
- `pnpm test -- --run` baseline: 25 files / 748 tests passing.
- `pnpm lint` has no ESLint config in this repo (interactive prompt); not a usable check.
- Visual: Playwright screenshots of `/` at 1440 and 390 wide (script in session scratchpad).

## Delivery
- Strategy: single-pr for Phase 1 (each phase is its own PR). Forecast ~600-800 changed lines, mostly className swaps; accepted as one reviewable styling PR because splitting tokens from their consumers would leave intermediate commits visually broken.
- RDD: on (global). Assess after each work-unit commit.

## Tasks
- [x] T1 — Tokens + buttons + shell. `app/globals.css`: brand tokens (`--brand-navy`, `--brand-navy-deep`, `--brand-gold`, `--brand-gold-soft`, `--surface-muted`) mapped in `@theme inline` as `--color-brand-*`; remove `--brand-orange`/`--brand-blue`. `components/ui/button.tsx`: add `brand` and `brand-outline` variants (+ `xl` size if needed). New `components/ui/section-label.tsx`. Apply to `header.tsx`, `footer.tsx`, `hero-section.tsx` (remove the "2024" badge, navy background, gold CTA; keep carousel). Route: delegated (writer trigger: 5+ non-trivial files).
- [x] T2 — Sections on the new system. Apply tokens, `Button` variants and `SectionLabel` to every section in `components/sections/*`, `components/services-section.tsx`, `components/service-card.tsx`, `components/faq-section.tsx`. Backgrounds follow the rhythm: hero navy → pilares white → ventajas navy → servicios muted → beneficios white → testimonios navy → proceso white → nosotros muted → FAQ white → contacto navy. Route: delegated.
- [x] T3 — Verify: tsc baseline, vitest, Playwright desktop + mobile screenshots reviewed by the orchestrator; open PR. Route: inline.

## Acceptance criteria
- No `from-purple`, `to-purple`, `from-blue-600`, `bg-blue-600`, `bg-black` (as CTA), `#F1AD32`, `bg-green-50`, `bg-amber-50`, `bg-purple-50` left in `components/sections`, `components/layout`, `components/services-section.tsx`, `components/service-card.tsx`, `components/faq-section.tsx`.
- Every primary CTA on the landing uses `Button variant="brand"`; secondary ones `brand-outline`.
- Section backgrounds only use white, `bg-surface-muted` (or equivalent token) and navy.
- All eyebrow labels render through `SectionLabel`.
- tsc and vitest at baseline; screenshots reviewed.

## Progress
- Branch `feat/visual-refresh-phase-1` from master (bc2174f). Baselines re-measured on this base: tsc 38 errors, vitest 29 files / 791 tests (master gained tests since the earlier 25/748 note).
- T1 done (commit 2607a1a, delegated writer): tokens `--brand-navy/-deep/-gold/-gold-soft/--surface-muted` exposed as `--color-brand-*`; `Button` variants `brand`, `brand-outline`, `brand-outline-light`, size `xl`; `components/ui/section-label.tsx`; header, footer, hero and `components/ui/services-slider.tsx` (the hero carousel lives there) on the new palette; `.nav-item` hover uses `var(--brand-gold)` in plain CSS. Evidence: tsc 36 (< baseline), vitest 29/791, grep for old tokens in T1 files empty; orchestrator reviewed Playwright captures of hero, nav dropdown, footer, mobile header. RDD assess (base master, committed-only, untracked excluded): medium, `review_due=false` (`under_budget`); pending in slice.
- Leftover hardcoded `#F1AD32`/`bg-black` outside T1 scope noted by the writer: `app/login`, `emails/*`, `components/auth/*`, `action-plan-section`, `process-section`, `about-section`, `page-legacy`, `service-hero`, `pricing-card`, `service-card`, `benefits-section`. Sections go in T2; login/emails/service pages are out of Phase 1 scope (candidate for Phase 2).

- T2 done (commit 237784d, delegated writer): all ten landing section files plus `components/testimonial-slider-new.tsx` on the navy/gold system and the agreed background rhythm. Writer removed dead per-item color fields from the Pilares/Ventajas/About data arrays, dropped the inline `Reckless, serif` font override in Benefits and FAQ, kept green/red only as semantic open/closed and form-status colors. `service-card.tsx` no longer reads `bgColor`/`textColor` (still present in `data/services.ts`, cleanup candidate for Phase 2). Evidence: tsc 36, vitest 29/791, forbidden-token grep only hits `trusted-brands-section.tsx` (not rendered).
- T3 done (inline): orchestrator reviewed Playwright captures of the full page at 1440 (9 chunks) and 390 (10 chunks). Two fixes applied inline: contact section moved to `bg-brand-navy` so it no longer merges with the `bg-brand-navy-deep` footer (footer gained `border-t border-white/10`), and the 31 literal "✓ " prefixes in `data/services.ts` features removed because `service-card` already renders a gold check icon (service detail pages use `feature.included`, unaffected; JSON-LD `itemListElement` gets cleaner text). Evidence: tsc 36, vitest 29/791.
- Observed but out of Phase 1 scope: service detail pages (`components/services/*`) still use the old blue theme; the Process section keeps its large scroll-driven whitespace (pre-existing); the Google Maps embed renders blank in headless Chromium (verify in a real browser).

- Native review (RDD): branch range master..24a6d4b assessed high (`hot_path` heuristic on the file name `security-social-section.tsx`), consent granted by the user, four lenses (risk, resilience, readability, reliability) captured in process, outcome approved, acknowledgement burned (lineage review-676e9524e482bfab, consumed revision sha256:4c3fdf27…). Preflight was previously blocked by the untracked `.atl/.skill-registry.cache.json`; it is now ignored via `.git/info/exclude` (local only).

## Phase 2 (authorized by the user on 2026-09-30, "dale con la fase 2")
Branch `feat/visual-refresh-phase-2` from origin/master (db4561c, PR #39 merged). Baselines: tsc 36, vitest 29/791. Delivery: single-pr for the phase.

Scope:
- Hero: replace the circular services carousel with a CSS-built dashboard mock (navy/gold; no screenshot because the dashboard needs an OTP login) that shows what the client gets: affiliations table, status badges, a floating "Afiliación aprobada" card. Keep headline, typed tagline, CTAs and trust line.
- Services grid: four cards without an orphan (`md:grid-cols-2 xl:grid-cols-4`), equal heights, feature lists capped with a link to the detail page; remove dead `bgColor`/`textColor` from `data/services.ts`.
- Service detail pages (`components/services/*`, `app/servicios/[slug]`) on the brand palette: `ServiceTheme` per-service colors collapse into the single brand look.
- Login page, auth forms and transactional emails on the palette (`app/login/page.tsx`, `components/auth/*`, `emails/*`). Emails use inline styles: gold `#E0A025`, navy `#012A61`.
- Assumption: real photos are not available in the repo; stock illustrations stay in Beneficios/Nosotros until the user supplies photos. Open item, not a task.

Tasks:
- [x] T4 — Hero with dashboard mock. New `components/ui/hero-dashboard-mock.tsx`; `hero-section.tsx` two columns; `services-slider.tsx` removed if unused. Route: delegated (writer trigger).
- [x] T5 — Services grid + data cleanup (`services-section.tsx`, `service-card.tsx`, `data/services.ts`). Route: delegated, same writer as T4.
- [x] T6 — Service detail pages on the palette. Route: delegated.
- [x] T7 — Login, auth forms and emails on the palette. Route: delegated, same writer as T6.
- [x] T8 — Verify (tsc 36, vitest, Playwright `/`, `/servicios/<slug>`, `/login` at 1440 and 390), PR. Route: inline.

Progress:
- Incident: the branch was first cut from a stale local `master`; a writer started on pre-Phase-1 code and was stopped. Branch reset to origin/master; a `git stash -u` + drop during the reset briefly lost the user's pre-existing `.atl/skill-registry.md` modification, restored from the dangling stash commit (8504c26).

- T4+T5 done (commit 4a7a3c2, delegated writer): `hero-dashboard-mock.tsx` (static server component: navy sidebar strip, three stat tiles, four-row status table, two floating pills hidden below `md`, gold glow); `services-slider.tsx` deleted (typed tagline already lived in the hero); services grid `md:2 / xl:4` with feature lists capped at 5 + "Ver todos los servicios" link and bottom-aligned buttons; `bgColor`/`textColor` removed from `data/services.ts` and the unused `ServiceCategory` in `lib/types.ts`. Evidence: tsc 36, vitest 29/791; orchestrator reviewed captures at 1440 and 390 (no overflow). Leftover `bgColor`/`textColor` only in `pricing-card.tsx`/`pricing-section.tsx`, rendered solely by `app/page-legacy.tsx` (not in scope). Known nit: the hero keeps a pre-existing empty gap under the typed tagline on desktop (`min-h`).

- RDD on 4a7a3c2 (base master, committed-only): medium, `review_due` (`slice_budget_reached`), consent granted by the user, one reliability lens captured, approved and acknowledged (lineage review-f09c42325e1d6214). Reviewed boundary advances to 4a7a3c2.

- T6+T7 done (commit dc102f6, delegated writer): `components/services/*` read brand classes directly; `ServiceTheme`, `serviceThemes` and the `theme` field deleted from `data/services.ts`; service hero navy with gold last word; step chips gold; CTA `brand-navy-deep`; login gradient navy with one gold and one white blob; auth forms `brand` button, gold focus ring and resend link; emails `#F1AD32`→`#E0A025`, headers/accents `#012A61`, gold-soft box `#FBF1DC`, semantic warning/success colors kept. Evidence: tsc 36, vitest 29/791, forbidden-token grep empty; orchestrator reviewed captures of `/servicios/afiliaciones-seguridad-social` (4 chunks at 1440), 390 top, and `/login` at 1440. Inline follow-up a4733f0: `pulse-glow` keyframes recolored from blue to gold (`rgba(224,160,37,…)`). Writer notes: emails have no buttons; `service-timeline.tsx` no longer reads the per-item `color` field (still in data, cleanup candidate); OTP code gold on light gray may be low contrast; OTP step and rendered emails not captured.

- RDD on 4a7a3c2..a4733f0 (committed-only): high (`hot_path` on `components/auth/email-step-form.tsx`), consent granted by the user, four lenses captured; the resilience capture was refused once on admission (reviewer evidence reported the candidate could not be inspected) and was relaunched exactly once on the same reoffered slot, then admitted; outcome approved with 11 advisory (non-blocking, informational) findings, acknowledged and burned (lineage review-1cf3733c7a2d0676). Advisory locations for later work: `service-timeline.tsx:12-16` (single-value color map), `service-hero.tsx:31-34` (title split by last word, untested), `service-hero.tsx:78-79` and `service-cta.tsx:79-86` (CTA handlers), `service-features.tsx:71`, `app/globals.css:288-289`, `email-step-form.tsx:89` (className tokens unverified by the reviewer), `service-related.tsx:5` (Button import removed).
- Inline follow-up 29beac8: service pages used a placeholder WhatsApp number (`573001234567`, pre-existing since 2025-12-20) while Contacto uses the real one (`573197941064`); aligned both service components. Assess vs a4733f0: medium, 4 lines, `under_budget`.
- Open items for the user: real photos for Beneficios/Nosotros (stock illustrations remain); `pricing-card.tsx`/`pricing-section.tsx` keep old pastel props but only `app/page-legacy.tsx` renders them; OTP code color gold on light gray may need a contrast check; hero keeps a pre-existing gap under the typed tagline on desktop; Google Maps embed to verify in a real browser.

## Phase 3 (authorized by the user on 2026-10-01, "continua con la fase 3")
Branch `feat/visual-refresh-phase-3` from origin/master (2178063, PR #40 merged). Baselines: tsc 36, vitest 29/791. Delivery: single-pr.

Scope (cleanup and polish; no new surfaces):
- Dead code: `app/page-legacy.tsx` is not a route in the App Router (only `page.tsx` mounts) and is the sole consumer of `components/pricing-section.tsx` and `components/pricing-card.tsx`, which still carry old pastel colors. Delete the three files.
- Hero tagline gap: `hero-section.tsx` builds `min-h-[${…}]` by string interpolation; Tailwind cannot generate interpolated classes, so only the static `md:min-h-[120px]` applies and produces the empty band under the typed tagline. Replace with static classes sized to the tagline's two lines.
- OTP email contrast: `emails/otp-email.tsx` renders the code in gold `#E0A025` on a light box; switch the code to navy `#012A61` on the gold-soft box, keep the gold dashed border.
- Advisory follow-ups from the Phase 2 review: drop the unread `color` field from `TimelineItem` and the timeline data in `data/services.ts`; guard the gold last-word highlight in `service-hero.tsx` so single-word names render plainly; replace the interpolation-free template literal className in `service-features.tsx:71` with a plain string.
- Still open (user input needed): real photography for Beneficios/Nosotros; Google Maps embed check in a real browser.

Tasks:
- [x] T9 — Delete `app/page-legacy.tsx`, `components/pricing-section.tsx`, `components/pricing-card.tsx`; confirm nothing else imports them. Route: delegated.
- [x] T10 — Hero tagline static min-height. Route: delegated, same writer.
- [x] T11 — OTP email code contrast. Route: delegated, same writer.
- [x] T12 — Timeline `color` cleanup, title-split guard, template literal cleanup. Route: delegated, same writer.
- [x] T13 — Verify (tsc 36, vitest, Playwright hero at 1440/390, service page hero), RDD assess, PR. Route: inline.

Progress:
- T9–T12 done (commit ecc8f8c, delegated writer): three dead files removed (only other mention is a line in `docs/CLAUDE_LANDING.md`, left as is); hero tagline on static `min-h-[3.5rem] md:min-h-[4rem|4.5rem]`; OTP code navy on gold-soft, and the security-box header in `login-success-email.tsx` moved from gold to navy by the same rule; `TimelineItem.color` removed from type and data; single-word service names no longer emit an empty prefix span; plain-string className in `service-features.tsx`. Evidence: tsc 35 (< 36 baseline), vitest 29/791; orchestrator reviewed hero at 1440 (gap gone) and the service page hero.
- Note: local `master` lagged origin again when assessing (reported 1510 lines including Phase 2); fixed with `git branch -f master origin/master` before the real assessment: medium, 743 lines (mostly deletions), `slice_budget_reached`, consent granted by the user, one reliability lens.

- RDD on master..ecc8f8c: approved and acknowledged (lineage review-fdf2f575e4ca4780) with 3 advisory suggestions/warnings (non-blocking): `hero-section.tsx:28` (tagline min-height), `service-hero.tsx:33-34` (title split), `data/services.ts:548` (timeline data).
- Still open for the user: real photography for Beneficios/Nosotros; Google Maps embed check in a real browser; `docs/CLAUDE_LANDING.md` still mentions `page-legacy`.

## Next step
Phase 3 PR review/merge. The visual refresh is complete unless the user supplies photos (that would be a small Phase 4: swap the Beneficios/Nosotros illustrations).
