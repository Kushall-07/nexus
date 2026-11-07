# NEXUS — Design Reference Analysis
## Phase 7, Phase 1

**Date:** 2026-11-07  
**Method:** Research from design knowledge and available web resources

---

## 0. How to Read This Document

For each reference, this analysis answers:
1. What makes it valuable as a design reference
2. Which specific patterns NEXUS should adopt
3. What should be adapted (not copied directly)
4. What should not be used at all
5. Where it belongs in the NEXUS product

---

## 1. Linear App

**Reference:** Linear's application design and changelog at linear.app

### What Makes Linear Valuable

Linear is widely regarded as the benchmark for modern B2B SaaS design. It earns this reputation through design discipline rather than visual novelty:

- **Information density without clutter.** Linear displays complex project data (issue lists, cycles, priorities, assignments) without crowding. It achieves this through precise spacing, careful typographic hierarchy, and consistent use of weight/color to establish importance.
- **Navigation that disappears into the background.** The sidebar is functional but never the focus. Navigation groups are labeled minimally, icons are restrained, and the active state is a subtle highlight rather than a bold selection.
- **Keyboard-first interaction.** Every action in Linear has a keyboard shortcut. The command palette (Cmd+K) is a first-class interface, not an afterthought.
- **Motion as communication.** Transitions are fast (120–200ms) and directional — opening an issue slides right, closing slides left. Motion shows what changed, not what looks impressive.
- **Typography at the right scale.** Linear uses a mid-size sans-serif body (14px) with strong contrast between heading and body weights. Number and status displays use tabular figures for alignment.
- **Status as color.** Priority and status use small, contained color chips — not full-width colored blocks. Color communicates state without dominating the UI.
- **Consistent radius and shadow.** A single border-radius value and minimal shadow vocabulary create cohesion across all surfaces.

### What NEXUS Should Adopt

1. **Collapsible sidebar with compact icon mode.** Linear's sidebar collapses to icon-only when space is needed. NEXUS currently has a fixed 224px sidebar. Phase 3 should add an expand/collapse toggle.

2. **Navigation group labels.** Linear's small, uppercase group labels for sidebar sections (Projects, Views, etc.) are well-executed. NEXUS already has group labels; the visual refinement in Phase 3 should follow Linear's restrained treatment.

3. **Command palette (Cmd+K).** Linear's command palette is essential to the product experience. NEXUS should implement a full command palette in Phase 3 with job search, page navigation, role switching, and GitHub analysis actions.

4. **Active nav state design.** Linear's active state: a slightly elevated background with no visible left-border flourish. It's quieter than NEXUS's current gold inset shadow. Consider whether the NEXUS gold inset shadow should be preserved as a brand differentiator (yes — it communicates the gold accent) or softened.

5. **Table design for Application Tracker.** Linear's issue list is an excellent model for NEXUS's `/applications` page. Status chips, inline editing, sortable columns.

6. **Motion timing.** Adopt 120–200ms transitions for state changes (hover, active, panel open). Current NEXUS animations are well-timed; Linear reinforces this direction.

7. **Data-dense page layouts.** Some NEXUS pages (Skill Overview, Gap Analysis) could use Linear-style dense list views rather than card-heavy layouts.

### What to Adapt

- **Linear's gray palette.** Linear uses a neutral cool-gray palette; NEXUS uses a warm dark palette with gold accents. Do not copy Linear's palette — adapt the structural discipline to the Gold Signal brand.
- **Linear's issue icons.** Linear has a rich custom icon set for issue states, priorities, teams, etc. NEXUS needs its own icon vocabulary for skills, evidence strength, match quality, and career progression.
- **Linear's kanban/cycle views.** Not applicable to NEXUS's product domain.

### What NOT to Copy

- Linear's overall identity (the purple accent, the specific gray tones, the sprint/issue/project metaphor)
- Linear's grid density for all pages — NEXUS has different information types that need different density levels

### Where It Belongs in NEXUS

- **Phase 3:** Authenticated application shell, sidebar, navigation, command palette, Application Tracker table
- **Phase 4:** Interaction quality, motion timing, keyboard navigation completeness

---

## 2. shadcn/ui

**References:** ui.shadcn.com/blocks, ui.shadcn.com/blocks/sidebar, ui.shadcn.com/docs/components

### What Makes shadcn/ui Valuable

shadcn/ui is a collection of accessible, composable React components built on Radix UI primitives, styled with Tailwind CSS. Its value is:

- **Source code ownership.** Components are copied into the project, not consumed as a package. Full control over styling and behavior.
- **Accessibility by default.** Built on Radix UI, which handles ARIA, keyboard navigation, and focus management correctly.
- **Tailwind CSS v4 compatibility.** The latest shadcn supports Tailwind v4 with `@theme inline` blocks — compatible with NEXUS.
- **Rich component catalog.** Button, Input, Select, Dialog, Command (palette), Table, Chart (Recharts), Sidebar, NavigationMenu, Drawer, Sheet, Toast/Sonner, Badge, Avatar, Skeleton, Empty states, and more.
- **Dashboard blocks.** shadcn/blocks includes pre-built dashboard layouts with sidebars, charts, stats cards, and data tables — directly applicable to NEXUS.
- **Chat primitives.** MessageScroller, Message, Bubble, Trace — applicable to NEXUS's Copilot feature.
- **Design system support.** DESIGN.md → preset → token system workflow is documented and supported.

### shadcn Compatibility with NEXUS

**Current state:** shadcn is NOT installed in the NEXUS project. No `components.json`, no `@/components/ui/`.

**Compatibility assessment:**
- Tailwind CSS v4 ✓ (NEXUS uses `@tailwindcss/vite` v4.3.3)
- React 19 ✓
- TypeScript ✓
- Vite ✓

**Key challenge:** NEXUS uses semantic slot remapping — `indigo-700` = Gold, `slate-50` = Midnight Black. This conflicts with shadcn's default semantic tokens (`--primary`, `--background`, `--foreground`). Integration requires mapping the Gold Signal tokens to shadcn's CSS variable system.

**Integration strategy for Phase 3:**

Option A — Native shadcn integration with Gold Signal mapping:
```css
/* Map Gold Signal tokens to shadcn variables */
--background: oklch(5.5% 0.009 265);     /* Midnight Black */
--foreground: oklch(96% 0.012 90);       /* Warm White */
--primary: oklch(81% 0.195 86);          /* Vibrant Gold */
--primary-foreground: oklch(5.5% 0.009 265); /* Midnight Black on gold */
--card: oklch(8% 0.008 265);             /* Dark surface */
--muted: oklch(13% 0.007 265);           /* Subtle surface */
```

Option B — Use shadcn as structural primitives, override all styling:
Install shadcn, but override component styles to match NEXUS Gold Signal design. More control, more work.

**Recommendation:** Option A — proper token mapping in Phase 3 with the `shadcn` skill's design system workflow.

### What NEXUS Should Use from shadcn

| Component | NEXUS Use |
|---|---|
| `Command` + `Dialog` | Global Cmd+K command palette |
| `Sidebar` | Authenticated app sidebar with collapse |
| `Table` | Application Tracker (/applications) |
| `Chart` (Recharts) | Skill score distributions, application funnel |
| `Dialog` / `Sheet` / `Drawer` | Modals, side panels, mobile drawers |
| `Badge` | Match labels, skill status, evidence strength |
| `Avatar` | User profile, GitHub identity |
| `Tooltip` | Evidence explanations, match detail popups |
| `Tabs` | Role gap analysis sections, skill categories |
| `Progress` | Career profile completion |
| `Skeleton` | Loading states throughout |
| `Toast` / `Sonner` | Save confirmations, analysis status |
| `Select` | Job filters (work mode, experience level) |
| `MessageScroller` + `Message` + `Bubble` | Career Copilot chat interface |
| `NavigationMenu` | Public website header navigation |

### What NOT to Copy from shadcn

- shadcn's default visual style directly (it looks neutral/gray by default)
- The nova/vega/maia preset colors — use Gold Signal tokens instead
- Generic block layouts without adapting to NEXUS's information hierarchy

### Where It Belongs in NEXUS

- **Phase 3:** Primary component system for authenticated application
- **Phase 2:** `NavigationMenu` and hero section components for the public website

---

## 3. Naukri.com

**References:** Naukri's onboarding flow and job search experience

### What Makes Naukri Valuable

Naukri is one of the largest job discovery platforms in Asia. Despite its dated visual design, it has evolved some highly effective UX patterns through years of user testing:

- **Search-first entry.** The primary interface is a search bar with keyword + location inputs — job discovery starts with intent, not browsing.
- **Filter sidebar with facets.** Filters (experience level, salary range, company, job function, location, work mode) are organized in a persistent left sidebar with expand/collapse for each category. This is the established pattern for job search UX.
- **Job card design.** Each job card shows: title, company, experience requirement, salary (if disclosed), key skills, location, posting date. The hierarchy is clear — title first, company second, metadata last.
- **Profile completion prompts.** Naukri uses persistent profile completion indicators ("Your profile is 60% complete"). This directly applies to NEXUS's Dashboard setup checklist.
- **Quick Apply.** One-click apply directly from the list view — application initiation should be as low-friction as possible.
- **Recruiter identity.** Job cards show the recruiter's company identity prominently, which builds trust.

### What NEXUS Should Adopt

1. **Filter sidebar for Job Discovery.** The Naukri filter sidebar model is the right pattern for NEXUS's `/opportunities` page. Persistent filters with facet categories (work mode, experience level, role type, source) with clear labels and collapsible sections.

2. **Job card information hierarchy.** Title → Company → Location/Mode/Type → Posted date → Skills. This hierarchy works across different job types and company sizes.

3. **Profile completion status.** NEXUS's Dashboard already has a setup checklist; Naukri's approach of showing percentage completion and linking directly to incomplete items is worth adopting.

4. **Search + filter combination.** Keyword search at the top of the page, filters in a sidebar below. The current NEXUS implementation has filters but the layout needs refinement.

### What to Adapt

- Naukri's layout is dense and visually dated (early 2010s SaaS aesthetic). NEXUS should take the structural logic (search + filter + list + detail) and apply it with the Gold Signal design language.
- Naukri shows salary only when disclosed — NEXUS should follow this pattern. Never display "N/A" for salary; omit it entirely when unavailable.

### What NOT to Copy

- Naukri's visual identity (green, white, dense text layouts)
- Naukri's advertisement-heavy layout (promoted jobs, banners)
- Naukri's heavy emphasis on recruiter outreach features

### Where It Belongs in NEXUS

- **Phase 3:** `/opportunities` page layout (filter sidebar, job list, job detail panel)
- **Phase 3:** Dashboard profile completion design

---

## 4. Candidate App

**Reference:** candidate.app/product

### What Makes Candidate Valuable

Candidate positions itself as a career OS for software engineers. It aggregates job opportunities, tracks applications, and helps developers manage their job search. Key patterns:

- **Career-centric framing.** Candidate frames the job search as a career management workflow, not just browsing. This is NEXUS's core positioning too.
- **Status-driven workflow.** Applications move through explicit stages (Applied → Phone Screen → Technical → Offer). The visual treatment of these stages (a Kanban-like progression) communicates the journey clearly.
- **Job matching from profile.** Candidate uses profile data to surface relevant opportunities. The match explanation pattern (why this job is relevant to you) is relevant to NEXUS.
- **Minimal profile setup.** Candidate reduces friction in profile creation — NEXUS should learn from this. The GitHub analysis flow should feel lightweight, not overwhelming.

### What NEXUS Should Adopt

1. **Application stage visualization.** A pipeline view (or at minimum clear stage labels) for the Application Tracker. Each stage should have a distinct visual state.
2. **Match-to-profile framing.** Each job in NEXUS shows match quality. Candidate's framing of "this matches your profile because..." reinforces the evidence-based value proposition.
3. **Reduced onboarding friction.** The setup checklist on NEXUS's Dashboard should guide users through GitHub analysis without feeling like a form to fill out.

### What to Adapt

- Candidate's visual style is clean and modern but fairly generic (gray/white with blue accents). NEXUS's Gold Signal palette is already more distinctive.
- Adapt the stage-based application tracking concept to NEXUS's 7 application statuses.

### What NOT to Copy

- Candidate's specific UI chrome or color system
- Any features that NEXUS's backend does not currently support

### Where It Belongs in NEXUS

- **Phase 3:** `/applications` page (application stages), job card detail design

---

## 5. Simplify

**Reference:** simplifyjobs.featurebase.app — application navigation and job-application workflow

### What Makes Simplify Valuable

Simplify is a job application tracker that uses a one-click browser extension model. Its dashboard shows applications in a structured tracker.

- **One-screen dashboard.** All active applications visible at a glance without drilling into details.
- **Status filtering.** Filter applications by status (Applied, Interviewing, etc.) at the top of the list.
- **Compact application row.** Each application shows: company logo, title, status, date applied, next action. Rows are compact and scannable.
- **Date tracking.** When an application was submitted is a first-class field, visible in the list. NEXUS already tracks `statusDate`.

### What NEXUS Should Adopt

1. **Compact application row design.** NEXUS's `/applications` page should use a compact table/list view rather than expanded cards. Status + date + title + company in a single scannable row.
2. **Status filter tabs.** Add status filter tabs at the top of the Applications page (All, Applied, Interviewing, Offer, Rejected) to quickly narrow the view.
3. **Inline status update.** Status select directly in the row, not in a modal. NEXUS already has a StatusSelect; keep it inline.

### What to Adapt

- Simplify's visual design is functional but not distinctive. Apply NEXUS's Gold Signal palette to the status colors: emerald = active/positive stages (interviewing, offer), amber = neutral (applied, planning), red = negative (rejected, withdrawn).

### What NOT to Copy

- Simplify's browser extension model (not applicable)
- Generic card-based layout

### Where It Belongs in NEXUS

- **Phase 3:** `/applications` page design

---

## 6. Kage-Inspired Landing Page Experience

**Concept:** Immersive full-page Three.js experience with scroll-driven visual storytelling, pointer interactions, and full-page composition.

### Analysis

The "Kage" concept represents a class of immersive SaaS landing pages that use Three.js to create distinctive, memorable first impressions. Examples: Stripe's gradient mesh, Linear's animated logo, Vercel's dark-with-glows aesthetic.

**What makes this valuable for NEXUS:**
- **Differentiation from generic SaaS landing pages.** A Three.js-driven hero immediately signals technical sophistication and investment in the product.
- **Scroll storytelling.** Scroll-driven scenes can explain a complex product (GitHub analysis → skills → job matching) through visual metaphor rather than text alone.
- **Pointer interaction.** Subtle pointer-reactive elements create engagement and a sense that the product is "intelligent and responsive."

**Visual themes appropriate for NEXUS (not temple/architectural):**
- A network of connected skill nodes that expands as you scroll
- GitHub commit graph evolving into a skill profile visualization
- Career pathways as branching light trails
- A three-dimensional "intelligence field" with orbiting skill categories

**Implementation concerns:**
- Three.js adds ~400–500KB (minified, before GZIP) to the bundle
- Must be loaded with dynamic import + React.lazy to avoid blocking the initial render
- Must fall back gracefully on mobile, low-power devices, and when WebGL is unavailable
- WebGL context loss handling required (happens on mobile Safari background/foreground)
- Must respect `prefers-reduced-motion: reduce` with a static fallback

### What NEXUS Should Use

**Recommended approach for Phase 2:**
- Three.js used only for the landing page hero section — not the full page
- Lazy-loaded with React.lazy + Suspense
- Static SVG fallback for mobile and reduced-motion
- Scene concept: an expanding network of career intelligence nodes (not a nature or architectural theme)
- Pointer-reactive: nodes subtly respond to cursor position with gentle parallax
- Scroll-reactive: at ~30% scroll depth, nodes coalesce into a visual representation of NEXUS's value proposition (skills → roles → jobs)

### What NOT to Do

- Do not load Three.js synchronously — it will delay page interactivity
- Do not create a full-page immersive "experience" that obscures the product message
- Do not use the original temple/kage theme
- Do not make the 3D scene essential for understanding the product (must work without it)

---

## 7. Sylva-Inspired Hero Experience

**Concept:** A living 3D world with Three.js rendering, interactive pointer behavior, responsive scaling, and sophisticated typography.

### Analysis

The "Sylva" concept describes a hero that is a world unto itself — a 3D environment that responds to user interaction and uses motion to communicate product value.

**What makes this valuable for NEXUS:**
- The "living" quality of the hero — the sense that the product is dynamic and intelligent
- Typography integrated with the 3D scene rather than layered on top of it
- Pointer interaction that makes the hero feel personally responsive

**Visual direction for NEXUS (not forest/nature):**
- A technical intelligence field: floating particles representing data points (repositories, commits, skill signals) that organize themselves into skill clusters as you watch
- The particles could use the gold palette — tiny bright gold nodes on a dark field
- As the user moves their cursor, the nodes shift perspective (subtle 3D parallax)
- Central focus: "NEXUS" in Barlow Condensed, with the nodes orbiting or attracted to the brand mark

### What NEXUS Should Use

**Phase 2 hero specification:**
- Background: Midnight Black (#08090B) with atmospheric gold glow (already in CSS)
- 3D element: Particle field using Three.js PointsMaterial (low polygon count, high performance)
- Particle color: Vibrant Gold at varying opacity (0.3–1.0)
- Pointer behavior: Particles gently attracted toward cursor position (repulsion is too aggressive)
- Scroll behavior: Particles fade as page scrolls, text content below hero comes into focus
- Mobile: Static gold constellation SVG (similar to existing CSS animation but improved)
- Text: "NEXUS" in Barlow Condensed 900 weight, large, with "Career Intelligence" in Inter below

**Performance targets:**
- Initial JS payload (Three.js scene): <50KB compressed
- 60fps on modern desktop hardware
- Degrade to static on mobile (< lg breakpoint or touchscreen detection)
- WebGL unsupported → static CSS gradient fallback

### What NOT to Do

- Do not create a photorealistic environment
- Do not use the nature/forest theme literally
- Do not load the hero scene synchronously

---

## 8. Liquid-Metal-Inspired Button System

**Concept:** WebGL 2 button effects with pointer-following visual response, hover/pressed/focus states, keyboard interaction, responsive sizing, and reduced-motion handling.

### Analysis

The "liquid metal" button concept uses raw WebGL 2 to render a metallic, fluid effect that follows the pointer. Each button is essentially a WebGL canvas overlay.

**What makes this valuable for NEXUS:**
- Memorable primary actions. The "Sign Up" or "Connect GitHub" buttons become distinctive product moments.
- Reinforces the "intelligence" brand personality — the button feels alive.
- Keyboard-accessible and reduced-motion compliant when implemented correctly.

**Implementation complexity:**
- Each button with this effect requires a WebGL context
- Multiple buttons = multiple WebGL contexts (browsers limit to ~16 per page)
- Performance cost is non-trivial on mobile
- Must be scoped to 2–3 hero actions maximum

### Button Hierarchy for NEXUS

| Level | Use Case | Treatment |
|---|---|---|
| Hero CTA | "Connect GitHub", "Start Free" on landing page | WebGL liquid-metal effect (Phase 2) |
| Primary (app) | "Analyze Repositories", "Run Scoring" | Vibrant Gold background, Midnight Black text, shimmer on hover (existing `.nx-cta-shimmer`) |
| Secondary (app) | "View Details", "Save Job", "Edit Preferences" | Dark surface with gold border, gold text |
| Tertiary (app) | "Cancel", "Close", navigation items | Transparent with subtle hover background |
| Destructive | "Delete Account", "Remove Resume" | Red accent with confirmation dialog |
| Icon-only | Save, dismiss, expand, collapse | Icon with tooltip, 36px touch target |

### What NEXUS Should Use

**Phase 2 (landing page only):**
- 1–2 hero CTAs with WebGL liquid-metal treatment (lazy-loaded)
- Fallback to `nx-cta-shimmer` class when WebGL unavailable
- Must have `focus-visible` ring and `prefers-reduced-motion` fallback

**Phase 3 (authenticated app):**
- Primary app buttons use the existing Gold Signal button treatment (bg-indigo-700 + shimmer)
- NO WebGL buttons inside the authenticated application — too expensive for a dense productivity UI
- Enhance the existing button system with better pressed/loading states via shadcn's Button component

### What NOT to Do

- Do not apply the liquid-metal effect to every button — it loses meaning and kills performance
- Do not use it inside the authenticated application navigation
- Do not implement it in a way that breaks keyboard navigation or focus management

---

## 9. Gallery-Heading-Inspired Typography

**Concept:** Oversized typography with 12 surrounding visual tiles, procedural Canvas 2D rendering, pointer-triggered movement, and different visual treatments per tile.

### Analysis

This concept uses large display typography as a visual anchor, surrounded by a grid of reactive visual tiles that respond to pointer movement. The tiles can use different visual treatments (color washes, texture patterns, photographs, data).

**What makes this valuable for NEXUS:**
- Creates visual impact at section level
- Demonstrates that the product values craft and detail
- Each tile can represent something meaningful (a skill category, a repository, a job match) — not just decoration

**Appropriate use cases in NEXUS:**
- Landing page section headings for major product capability sections ("GitHub Evidence Intelligence", "Skill Graph", "Job Matching")
- Could show actual skill/job data in the tiles — making the visualization informative, not just decorative

### What NEXUS Should Use

**Phase 2 — Optional, selective use:**
- 1–2 landing page sections where the gallery-heading effect communicates product capabilities
- Use actual NEXUS data concepts in the tiles: skill names, repository names, evidence signals, match percentages
- Tiles should communicate the product, not be arbitrary decorative elements

**Example application:**
Section: "SKILL INTELLIGENCE" heading in Barlow Condensed 900 weight, 6rem+
Tiles (6–8): Each shows a skill category (Python, React, Docker, etc.) with its gold score bar
Pointer movement: tiles gently tilt/shift in response to cursor proximity

### What NOT to Do

- Do not use on more than 2 sections — the effect loses impact if overused
- Do not make tiles purely decorative — tie them to real NEXUS data
- Do not let it interfere with content hierarchy or readability
- Do not implement it in the authenticated application — it's a marketing technique, not a productivity pattern

---

## 10. Synthesis: The NEXUS Visual Direction

Informed by all references, the recommended NEXUS visual direction is:

### Public Website
**"Technical Intelligence, Beautifully Surfaced"**

- Dark canvas (Midnight Black) — communicates technical depth and professionalism
- Gold accent everywhere meaningful — scores, CTAs, active states, data highlights
- Three.js particle network hero — communicates "intelligence" through motion and connectivity
- Barlow Condensed in large display sizes — distinctive, confident, technical
- One WebGL CTA button for the primary hero action
- Scroll-driven narrative that explains the product flow: Code → Analysis → Skills → Roles → Jobs
- Zero decorative elements — every visual element communicates product value

### Authenticated Application
**"Productive Intelligence"**

- Same color system, different information density
- Linear-inspired sidebar and navigation discipline
- shadcn component system mapped to Gold Signal tokens
- Data-first layouts (tables, scores, charts) rather than card grids
- Command palette for power-user navigation
- Motion only for state changes (not decorative)
- Skill network graph as the signature visualization (not Three.js — Canvas 2D for performance)

### Shared Identity Signals
- Vibrant Gold (#F6C900) as the single accent — used only for meaningful information
- Barlow Condensed for display headings, Inter for body, JetBrains Mono for data
- Tight letter-spacing on all display text
- Atmospheric background (the existing CSS body radial glows are correct — keep them)
- Evidence-based color semantics: Gold = active/valuable, Emerald = proven, Amber = partial, Red = missing

---

## 11. What to Avoid

Based on all references and the `frontend-design` skill guidance, NEXUS must avoid:

| Pattern | Why to Avoid |
|---|---|
| Warm cream + terracotta palette | AI cliché — signals template, not product |
| "One word in a different color" headline | AI cliché — headline fragmentation |
| Numbered step markers (01/02/03) unless actually sequential | AI cliché — structural decoration |
| Identical rounded cards everywhere | AI cliché — "SaaS card kit" |
| Spaced ALL-CAPS eyebrow labels above every heading | AI cliché — template chrome |
| Gradient washes as decoration | AI cliché — visual decoration without information |
| Excessive glassmorphism | Trendy, expensive, reduces legibility |
| Neon border glows on everything | 2021 design trend, not timeless |
| A large chat interface everywhere | Copilot is a feature, not the product |
| Fake testimonials or fabricated metrics | Undermines trust |
| Random Three.js for visual impact | Must tell the NEXUS story specifically |
| Liquid-metal effect on all buttons | Loses meaning, kills performance |
