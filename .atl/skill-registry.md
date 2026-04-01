# Skill Registry — admon-web

Generated: 2026-03-31

## User Skills

| Skill | Trigger | Source |
|-------|---------|--------|
| api-design-principles | Designing/reviewing REST or GraphQL APIs | user-level |
| branch-pr | Creating a pull request or preparing changes for review | user-level |
| error-handling-patterns | Implementing error handling, designing APIs, improving reliability | user-level |
| go-testing | Writing Go tests, using teatest, or adding Go test coverage | user-level |
| issue-creation | Creating GitHub issues, reporting bugs, requesting features | user-level |
| judgment-day | "judgment day", "dual review", "doble review", "juzgar" | user-level |
| brainstorming | Before any creative work — creating features, building components, modifying behavior | project-level |
| frontend-design | Building web components, pages, dashboards, React components, styling/beautifying web UI | project-level |
| vercel-react-best-practices | Writing, reviewing, or refactoring React/Next.js code for performance | project-level |
| seo-audit | SEO audit, technical SEO, meta tags review, SEO health check | project-level |
| supabase-postgres-best-practices | Writing, reviewing, or optimizing Postgres queries, schema designs | project-level |

## Project Conventions

| File | Purpose |
|------|---------|
| CLAUDE.md | Project root instructions — routes to CLAUDE_LANDING.md or CLAUDE_DASHBOARD.md |
| .claude/skills/vercel-react-best-practices/AGENTS.md | Navigation guide for Vercel React skill references |
| .claude/skills/supabase-postgres-best-practices/AGENTS.md | Navigation guide for Supabase Postgres skill references |

## Compact Rules

### brainstorming
- MUST use before any creative work (features, components, behavior changes)
- Explore user intent, requirements, and design BEFORE implementation
- Ask questions one at a time, present designs in small sections (200-300 words)

### vercel-react-best-practices
- Use Server Components by default, Client Components only when needed
- Avoid unnecessary `use client` — push interactivity to leaf components
- Prefer `loading.tsx` and Suspense for streaming
- Use `next/image` for images, `next/font` for fonts
- Avoid barrel files in Client Components

### frontend-design
- Commit to a BOLD aesthetic direction before coding
- No generic AI aesthetics — be distinctive and production-grade
- Use real working code with exceptional attention to detail

### supabase-postgres-best-practices
- Always add indexes for foreign keys and frequently filtered columns
- Use appropriate data types (e.g., `timestamptz` not `timestamp`)
- Avoid N+1 queries — use joins or batch operations
- Keep transactions short to avoid lock contention

### seo-audit
- Check meta tags, Open Graph, structured data
- Verify robots.txt, sitemap, canonical URLs
- Analyze Core Web Vitals and page speed
