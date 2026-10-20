# Hero 3D scene

## Objective
Replace the hero's right-side dashboard mock with a real-time 3D scene (Three.js via React Three Fiber) that gives the landing hero motion and depth.

## Problem / Why
The team photo did not work in the hero (moved to the About section) and the coded dashboard mock is static. The client wants a dynamic 3D hero.

## Scope
- 3D scene: central brand element (stylized shield/logo mark in navy + gold) with floating service cards (Afiliaciones/EPS, ARL, Pensión, Caja de compensación, Incapacidades) orbiting/floating around it; subtle mouse parallax; idle float animation.
- Integrate in `components/sections/hero-section.tsx` for desktop and mobile.
- Out of scope: other sections, copy changes.

## Constraints
- Next.js 15.2 App Router, React 19 → `three`, `@react-three/fiber@^9`, `@react-three/drei@^10`.
- Load client-only via `next/dynamic` with `ssr: false`; render a lightweight static fallback while loading so the hero never looks empty and LCP stays on the headline.
- Respect `prefers-reduced-motion` (no continuous animation).
- Cap DPR (e.g. `[1, 1.75]`), pause rendering when off-screen (`frameloop="demand"` or IntersectionObserver), keep it light on mobile (fewer elements / smaller canvas).
- Brand colors from existing tokens (brand-navy, brand-gold); copy in Spanish; identifiers/comments in English.
- Delivery budget heuristic ~400 authored lines (advisory only).

## TDD
Mode: off (no project/session TDD config found). Runner available: vitest (`pnpm test:run`). Ordinary checks apply.

## Tasks
- [x] T1 — Install deps and build `components/three/hero-scene.tsx` (+ dynamic wrapper) and wire into hero (route: delegated direct — writer trigger: 2+ non-trivial files, new deps). Commit 5e59b68.
- [ ] T2 — Verify: tsc (touched files clean — writer + parent spot check), `next build` passed (writer). `pnpm lint` UNAVAILABLE: repo has no ESLint config (interactive prompt). Pending: visual check in browser by user.

- [x] T3 — Fix review findings (accepted by user): (a) mount a single scene instance instead of desktop+mobile duplicates; (b) error boundary + WebGL-unavailable detection falling back to the static shield; (c) no Canvas remount on 640px breakpoint, correct initial size on mobile (route: delegated direct — writer trigger: 2+ non-trivial files). Checks: tsc clean on touched files (writer + parent spot check), next build passed (writer). New: components/three/hero-scene-fallback.tsx, error boundary in lazy wrapper, WebGL probe + contextlost, SceneSync (camera/invalidate), single HeroSceneLazy mount.
- [x] T4 — Redesign (user feedback 2026-10-20: shield scene "too dark and too simple"): isometric mini-world — orthographic camera, light floating platform (white/cream, gold edges), central Administración Segura office, 4 service buildings with 3D icons (EPS health cross, ARL hard hat, Pensión piggy bank, Caja de compensación house), paths connecting them with documents/tokens travelling office ⇄ services and a gold check on arrival, bright lighting + soft shadows. Keep lazy/fallback/error boundary/single mount/reduced-motion/offscreen pause infra. Procedural geometry only (no external models). Branch feat/hero-3d-isometric (route: delegated direct — writer trigger). Files: hero-scene.tsx, hero-scene-fallback.tsx, isometric/{constants,route,primitives,icons,buildings,flow}. Checks: tsc clean on touched files (writer + parent spot check), next build passed (writer). ~850 lines (over advisory heuristic: many small primitives). Pending: user visual check.

## Acceptance criteria
- Hero shows an animated 3D scene on desktop and mobile, no SSR errors, no hydration warnings.
- Static fallback visible before the canvas loads; reduced-motion users get a still scene.
- Typecheck, lint and build pass.

## Branch / delivery
Branch `feat/hero-3d`, stacked on `feat/about-team-image` (commit 1a24ac0). Strategy: ask-on-risk.

## Progress
- Created 2026-10-20.
- T1 done: three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, @types/three 0.186.0. Shield (navy #012A61 / gold #E0A025), 5 Html cards (3 on ≤640px), Float + sway + window-pointer parallax, Sparkles, Lightformer env (no CDN HDR), IntersectionObserver pauses frameloop, reduced-motion → still. Fallback: radial glow + SVG shield.
- Next: user visual check (card size/crowding, mobile, fallback swap, check-mark shape); tune constants at top of hero-scene.tsx.
