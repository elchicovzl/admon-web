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

## Next step
Phase 1 PR review/merge. Phase 2 candidates: hero layout redesign with a dashboard mock, real photos instead of stock illustrations, services grid 2x2/4-col, service detail pages and login/emails on the brand palette, `data/services.ts` color field cleanup.
