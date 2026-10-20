# Landing sections refresh

## Objective
Modernize three landing sections that the client finds outdated (Mission & Vision cards, Values cards, Benefits section) and add parallax/motion depth.

## Problem / Why
Identical white cards with beige icon squares, flat and static, clash with the new isometric 3D hero.

## Scope
- T1 Mission & Vision (About section): split contrast panels (navy Mission / light gold-bordered Vision), glass pills for the 4 pillars, Vision items as a gold-dot timeline, scroll parallax (panels at different speeds + large decorative "01"/"02" numerals moving slower).
- T2 Values (About section): bento grid with varied card sizes, big background numerals, gold icons without the square, 3D tilt + gold spotlight following the pointer on hover, staggered reveal.
- T3 Benefits section: sticky text column with scroll-driven image swap + gold progress bar, parallax on images and floating stat cards.
- Out of scope: replacing stock illustrations (future follow-up), copy changes.

## Constraints
- Use `motion` (already installed, `motion/react`) for scroll/parallax; no new deps unless justified.
- `prefers-reduced-motion`: no parallax/tilt, only a soft fade.
- Subtler parallax on mobile; no horizontal overflow; keep section ids/anchors.
- Brand tokens (brand-navy, brand-gold, brand-gold-soft); copy in Spanish; identifiers/comments in English.
- One PR per section. ~400 authored lines per task is advisory only.

## TDD
Mode: off (no project/session config). Runner: vitest. Ordinary checks: tsc on touched files, `next build`. `pnpm lint` unavailable (no ESLint config).

## Tasks
- [x] T1 — Mission & Vision redesign + parallax (branch feat/about-mission-vision-refresh; route: delegated direct — preparation/writer trigger). New components/sections/about/mission-vision.tsx; about-section.tsx renders it. Checks: tsc clean (writer + parent spot check), next build passed (writer). Visual check pending.
- [ ] T2 — Values bento + tilt
- [ ] T3 — Benefits sticky scroll story + parallax

## Acceptance criteria
- Each section looks modern, consistent with the hero, works at 375px and desktop, respects reduced motion.
- tsc clean on touched files and `next build` passes.

## Delivery
Strategy: ask-on-risk; one PR per task, merged on user request.

## Progress
- Created 2026-10-20.
