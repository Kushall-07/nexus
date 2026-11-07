# NEXUS — Skills and Plugins Audit
## Phase 7, Phase 1

**Date:** 2026-11-07  
**Source:** Inspected from `.claude/skills/`, `skills-lock.json`, system-available skills

---

## 1. Project-Level Skills (`.claude/skills/`)

These are installed in the NEXUS repository and confirmed present.

### 1.1 `frontend-design`

| Field | Value |
|---|---|
| **Source** | `anthropics/skills` (GitHub) |
| **File** | `.claude/skills/frontend-design/SKILL.md` |
| **Instructions inspected** | Yes — read in full |
| **Available** | ✓ Confirmed present |

**Purpose:**
Guidance for distinctive, intentional visual design. Approaches design as a studio designer with a brief: makes deliberate opinionated choices about palette, typography, and layout specific to the project. Explicitly teaches how to avoid AI design clichés.

**Key guidance extracted:**
- Design from the subject matter, not from default templates
- Typography carries personality — choose typefaces deliberately, not defaults
- One structural element should be memorable; keep everything else quiet and disciplined
- Use motion only to draw attention or answer user actions — not decorative
- Avoid: single-word italic accents in headlines, ALL CAPS labels, numbered markers (unless content is actually sequential)
- Run a two-pass process: brainstorm token system (color/type/layout/principles) → review against brief → build
- The 5 AI design tells to avoid: warm cream + serif + terracotta; near-black + acid green; broadsheet hairlines; the "SaaS card kit"; template chrome (ALL CAPS eyebrows, · separators, → arrows)

**Relevance to NEXUS:** Essential for Phase 2 (landing page) and Phase 3 (application redesign).

**Classification:** Essential

---

### 1.2 `shadcn`

| Field | Value |
|---|---|
| **Source** | `shadcn-ui/ui` (GitHub) |
| **File** | `.claude/skills/shadcn/SKILL.md` + rules/, agents/, cli.md, design-system.md |
| **Instructions inspected** | Yes — read SKILL.md in full |
| **Available** | ✓ Confirmed present |

**Purpose:**
Full management of shadcn/ui component library — adding components, debugging, styling, composing UI. Includes workflow rules for forms, icons, chat UI, composition, and design systems from DESIGN.md files.

**Key guidance extracted:**
- Components added as source code via CLI (`npx shadcn@latest add`)
- Uses semantic color tokens (`bg-primary`, `text-muted-foreground`) — not raw values
- Component selection table covers: buttons, forms, navigation, charts (Recharts), dialogs, command palette, chat/messaging primitives
- Tailwind v4 uses `@theme inline` blocks
- Current project: **shadcn is NOT installed** (no `components.json` present)

**shadcn installation status for NEXUS:**
- No `components.json` found
- No `@/components/ui/` directory
- No shadcn CSS variables in `index.css`
- Tailwind v4 is configured — compatible with shadcn v4 mode

**Relevance to NEXUS:**
- Phase 3: Recommend adopting shadcn for the authenticated application component system
- Requires careful integration with existing Gold Signal Tailwind v4 theme
- Must not conflict with the existing semantic slot remapping (`indigo-700` = Gold)

**Classification:** Strongly recommended (Phase 3)

---

### 1.3 `vercel-react-best-practices`

| Field | Value |
|---|---|
| **Source** | `vercel-labs/agent-skills` (GitHub) |
| **File** | `.claude/skills/vercel-react-best-practices/SKILL.md` + rules/ |
| **Instructions inspected** | Yes — read in full |
| **Available** | ✓ Confirmed present |

**Purpose:**
70 rules across 8 categories for React/Next.js performance optimization. Prioritized by impact.

**Key categories:**
1. Eliminating Waterfalls (CRITICAL) — Promise.all, Suspense streaming
2. Bundle Size Optimization (CRITICAL) — dynamic imports, avoid barrel files
3. Server-Side Performance (HIGH) — React.cache(), deduplication
4. Client-Side Data Fetching (MEDIUM-HIGH) — SWR deduplication
5. Re-render Optimization (MEDIUM) — memo, derived state, startTransition
6. Rendering Performance (MEDIUM) — content-visibility, hydration
7. JavaScript Performance (LOW-MEDIUM) — Map/Set lookups, early exit
8. Advanced Patterns (LOW) — useEffectEvent, refs

**Most applicable rules for NEXUS redesign:**
- `bundle-dynamic-imports` — heavy Three.js / WebGL components must use dynamic imports
- `bundle-barrel-imports` — existing pattern should stay clean
- `rerender-memo` — skill lists and job lists may benefit from memoization
- `rendering-animate-svg-wrapper` — wrap SVG animations in a div
- `rendering-conditional-render` — use ternary, not `&&` for conditionals
- `rerender-no-inline-components` — don't define components inside components

**Relevance to NEXUS:** Core technical reference for all implementation phases, especially for Three.js integration and long job/skill lists.

**Classification:** Strongly recommended (Phases 2, 3, 4)

---

### 1.4 `web-design-guidelines`

| Field | Value |
|---|---|
| **Source** | `vercel-labs/agent-skills` (GitHub) |
| **File** | `.claude/skills/web-design-guidelines/SKILL.md` |
| **Instructions inspected** | Yes — read in full |
| **Available** | ✓ Confirmed present |

**Purpose:**
Reviews UI code against Vercel's Web Interface Guidelines. Fetches latest rules from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` and reports violations in `file:line` format.

**Use case:**
- Run as a quality gate after Phase 3 implementation
- Checks accessibility, semantic HTML, responsive design, interaction conventions

**Relevance to NEXUS:** Quality assurance tool for Phase 4 (accessibility/UX review).

**Classification:** Optional — quality gate tool (Phase 4)

---

## 2. Available System/Session Skills

These skills appear in the Claude Code session's available skills list (from system context):

### 2.1 `taste-skill` / `taste-skill:taste-skill`

| Field | Value |
|---|---|
| **Available in session** | ✓ Listed in session context |
| **Available in project** | ✗ NOT in `.claude/skills/` |
| **Inspected** | Description only (not installed in project) |

**Description from session:**
"tasteskill 2.5.0, the anti-slop frontend skill. Builds professional company websites at the level of figma.com and x.ai: plain copy, one system, one section per screen, equal edges, real photographs and real product UI."

**Relevance:**
High relevance for the landing page. This skill enforces a minimal, opinionated page structure with a "one system, one section per screen" approach — directly applicable to the NEXUS public website.

**Recommendation:** Use for Phase 2 (public landing page) alongside `frontend-design`.

**Classification:** Strongly recommended (Phase 2) — available in session but not project-installed

---

### 2.2 `nateherk-design:scroll-craft`

| Field | Value |
|---|---|
| **Available in session** | ✓ Listed in session context |
| **Available in project** | ✗ NOT in `.claude/skills/` |
| **Inspected** | Description only |

**Description from session:**
"Build premium scroll-driven landing pages for service, product, food, and drink brands. Plan the visitor journey, page grammar, emotional peak, and bespoke signature move. Create dimensional heroes with independent visual planes, restrained motion…"

**Relevance:**
Relevant for scroll-driven storytelling on the NEXUS landing page. However, the description notes it's optimized for service/product/food/drink brands — NEXUS is a technical SaaS product, so scroll-craft's emphasis on "visitor journey" and "emotional peak" may not align perfectly with a developer-facing product.

**Recommendation:** Use as optional reference for scroll interaction patterns. Do not force scroll-craft's storytelling approach into the NEXUS landing page; adapt selectively.

**Classification:** Optional (Phase 2) — available in session but not project-installed

---

### 2.3 `frontend-design` (session version)

Also available as a session skill mirroring the project-installed version.

---

### 2.4 `shadcn` (session version)

Also available as a session skill mirroring the project-installed version.

---

### 2.5 `vercel-react-best-practices` (session version)

Also available as a session skill mirroring the project-installed version.

---

### 2.6 `web-design-guidelines` (session version)

Also available as a session skill mirroring the project-installed version.

---

## 3. Skills Mentioned But Not Found

The following skills were referenced in the Phase 1 prompt as potentially installed or available. Each has been investigated.

### 3.1 `dataviz`

| Field | Value |
|---|---|
| **Available in project** | ✗ Not found in `.claude/skills/` |
| **Available in session** | ✗ Not listed in available skills |
| **Status** | Not installed |

**What it would have provided:** Dashboard visualization guidance, chart selection, data density, analytics presentation.

**Alternative available:** No direct replacement. For chart/visualization decisions in NEXUS, the following approach is recommended:
- Recharts (via shadcn's `Chart` wrapper) for skill score distributions and application funnel
- Custom Canvas/SVG for the skill network visualization
- Simple HTML/CSS for score bars (already implemented via `ScoreMeter`)

---

### 3.2 `anthropic-skills:docs` / `docx` / `pptx` / `xlsx` / `pdf`

| Field | Value |
|---|---|
| **Available in project** | ✗ Not found |
| **Available in session** | ✗ Not listed |
| **Status** | Not installed in this environment |

**What they would have provided:** Document generation in various formats.

**Relevance to NEXUS redesign:** Low — document generation is not required for UI design/implementation. The Phase 1 reports are Markdown documents only.

---

### 3.3 `anthropic-skills:google-workspace`

| Field | Value |
|---|---|
| **Status** | Not found |
| **Relevance** | Not relevant to frontend redesign |

---

### 3.4 `anthropic-skills:deep-research`

| Field | Value |
|---|---|
| **Status** | Not found |
| **Relevance** | Would have been useful for comprehensive web research on design references. Web search and web fetch tools are available as alternatives. |

---

### 3.5 `anthropic-skills:built-in-browser` / `chrome-browser`

| Field | Value |
|---|---|
| **Status** | Not found as explicit skills |
| **Relevance** | WebFetch and WebSearch tools are available as alternatives for design reference research |

---

### 3.6 `anthropic-skills:computer-use`

| Field | Value |
|---|---|
| **Status** | Not found |
| **Relevance** | Not required for this phase |

---

### 3.7 `anthropic-skills:morning` / `import-memory` / `skill-creator`

| Field | Value |
|---|---|
| **Status** | Not found |
| **Relevance** | Not relevant to frontend redesign |

---

## 4. Available Built-in Claude Code Capabilities

| Capability | Available | Relevance |
|---|---|---|
| Explore agent | ✓ | Used for codebase reconnaissance |
| Plan agent | ✓ | Available for architecture planning |
| General-purpose agent | ✓ | Used for multi-step tasks |
| WebFetch | ✓ | Design reference research |
| WebSearch | ✓ | Design reference research |
| TodoWrite | ✓ | Task tracking |
| Read / Write / Edit / Glob / Grep | ✓ | File operations |
| Bash | ✓ | System commands |
| Simplify skill | ✓ | Code quality review |

---

## 5. Skills Audit Summary Table

| Skill / Plugin | Available? | Phase | Purpose | Instructions Read | Classification |
|---|---|---|---|---|---|
| `frontend-design` | ✓ Project + Session | 2, 3 | Distinctive visual design, avoid AI clichés | Yes | **Essential** |
| `shadcn` | ✓ Project + Session | 3 | Component system adoption | Yes | **Strongly recommended** |
| `vercel-react-best-practices` | ✓ Project + Session | 2, 3, 4 | React performance, bundle optimization | Yes | **Strongly recommended** |
| `web-design-guidelines` | ✓ Project + Session | 4 | Accessibility/UX quality gate | Yes | **Recommended** |
| `taste-skill` | ✓ Session only | 2 | Premium landing page visual quality | Description only | **Strongly recommended** |
| `nateherk-design:scroll-craft` | ✓ Session only | 2 | Scroll-driven storytelling | Description only | **Optional** |
| `dataviz` | ✗ Not found | — | Dashboard visualization guidance | N/A | **Not available** |
| `anthropic-skills:*` (docs, pdf, etc.) | ✗ Not found | — | Document generation | N/A | **Not relevant** |
| `deep-research` | ✗ Not found | — | Web research | N/A | **Not available — WebFetch used instead** |
| `computer-use` | ✗ Not found | — | Browser automation | N/A | **Not relevant** |

---

## 6. Skill Usage Recommendations by Phase

### Phase 1 (This Phase)
- **Used:** Explore agent (codebase reconnaissance), general-purpose agent (backend audit, design research)
- **Not invoked for implementation** — discovery only

### Phase 2 (Public Landing Page)
1. **`frontend-design`** — Primary design guidance. Run before writing any landing page code. Follow the two-pass process: token system → review → build
2. **`taste-skill`** — Apply for landing page section structure, visual quality bar, and copy
3. **`nateherk-design:scroll-craft`** — Optional reference for scroll-driven section patterns
4. **`vercel-react-best-practices`** — Apply `bundle-dynamic-imports` for Three.js; apply rendering performance rules

### Phase 3 (Authenticated Application)
1. **`shadcn`** — Component adoption for authenticated UI. Init with appropriate preset; map Gold Signal tokens to shadcn variables
2. **`frontend-design`** — Apply to custom components and feature pages
3. **`vercel-react-best-practices`** — Apply throughout — especially for job/skill list optimization

### Phase 4 (Refinement and QA)
1. **`web-design-guidelines`** — Run as a final quality gate review
2. **`vercel-react-best-practices`** — Apply optimization pass
3. **`simplify`** (built-in) — Code quality review

---

## 7. Findings

1. **Four core skills are confirmed and instructions have been read in full.** `frontend-design`, `shadcn`, `vercel-react-best-practices`, and `web-design-guidelines` are all present in the project and can be invoked in implementation phases.

2. **Two additional session skills are available.** `taste-skill` and `nateherk-design:scroll-craft` are available in this Claude Code session. They are not project-installed but can be invoked directly.

3. **`dataviz` is not available.** No visualization skill is installed. Chart decisions for NEXUS will be made based on design research and Recharts (available via shadcn).

4. **Anthropic utility skills (docs, PDF, office formats) are not found.** Not required for this redesign — the deliverables are Markdown reports.

5. **WebFetch and WebSearch are available** as alternatives to `deep-research` for design reference investigation.
