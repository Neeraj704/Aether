# 📜 AETHER — MASTER PROMPT CHRONICLE & WORKWAYS COMPENDIUM
> **An Exhaustive, Step-by-Step Breakdown of All 12 Build Prompts, Architectural Evolutions, and Agentic Engineering Workways**
> *Document Purpose:* Complete contextual blueprint of how AETHER was engineered iteratively from inception to frontend freeze, documenting every prompt's intent, scope, achievements, bug fixes, and non-goals for future AI agents and engineers.

---

## 🧭 TABLE OF CONTENTS

1. [The AETHER Engineering Methodology & Workways](#1-the-aether-engineering-methodology--workways)
2. [Prompt Matrix & Chronological Overview](#2-prompt-matrix--chronological-overview)
3. [Deep-Dive Breakdown of Each Prompt](#3-deep-dive-breakdown-of-each-prompt)
   - [3.0 Prompt 00 (Start) — Phases 4–7 Master Plan & Ground Rules](#30-prompt-00-start--phases-47-master-plan--ground-rules)
   - [3.1 Prompt 01 (v0) — Initial Frontend Architecture & The Loom Foundation](#31-prompt-01-v0--initial-frontend-architecture--the-loom-foundation)
   - [3.2 Prompt 02 (AntiGravity) — Phase 2: Bot Detail Experience & Backtest Simulator](#32-prompt-02-antigravity--phase-2-bot-detail-experience--backtest-simulator)
   - [3.3 Prompt 03 (AntiGravity) — Phase 2 Patch: Suspense Boundaries & Live Tab Scoping](#33-prompt-03-antigravity--phase-2-patch-suspense-boundaries--live-tab-scoping)
   - [3.4 Prompt 04 (AntiGravity) — Phase 3: Legal Architecture & Auth Flows](#34-prompt-04-antigravity--phase-3-legal-architecture--auth-flows)
   - [3.5 Prompt 05 (AntiGravity) — Phase 4: Bug Bash, Dead Links & Real Auth Guards](#35-prompt-05-antigravity--phase-4-bug-bash-dead-links--real-auth-guards)
   - [3.6 Prompt 06 (AntiGravity) — Phase 5: Missing Pages, Onboarding & Ecosystem](#36-prompt-06-antigravity--phase-5-missing-pages-onboarding--ecosystem)
   - [3.7 Prompt 07 (AntiGravity) — Phase 6: Node System Overhaul & Deep Customization](#37-prompt-07-antigravity--phase-6-node-system-overhaul--deep-customization)
   - [3.8 Prompt 08 (AntiGravity) — Phase 7: Graph & Storage Normalization (`BotGraph` v2)](#38-prompt-08-antigravity--phase-7-graph--storage-normalization-botgraph-v2)
   - [3.9 Prompt 09 (AntiGravity) — Phase 7.1: Publish-to-Marketplace Bridge & Route Fixes](#39-prompt-09-antigravity--phase-71-publish-to-marketplace-bridge--route-fixes)
   - [3.10 Prompt 10 (AntiGravity) — Phase 8: Polish Pass, Creator Discoverability & Live Feed](#310-prompt-10-antigravity--phase-8-polish-pass-creator-discoverability--live-feed)
   - [3.11 Prompt 11 (AntiGravity) — Phase 9: Final Punch List & Frontend Freeze](#311-prompt-11-antigravity--phase-9-final-punch-list--frontend-freeze)
4. [Evolutionary Milestones & Architectural Shifts](#4-evolutionary-milestones--architectural-shifts)
5. [Immutable Agent Rules for Future Development](#5-immutable-agent-rules-for-future-development)

---

## 1. THE AETHER ENGINEERING METHODOLOGY & WORKWAYS

The entire AETHER codebase was constructed through a disciplined, prompt-driven AI pair-programming process. Understanding these **workways** is critical for any LLM interacting with this project:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          AETHER AGENTIC WORKWAY PRINCIPLES                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. BOUNDED, SINGLE-PHASE PROMPTS:                                                      │
│    Never combine multiple large phases into one agent prompt. Work is divided into     │
│    narrow, strictly scoped milestones with explicit file whitelists.                   │
│                                                                                        │
│ 2. ZERO BACKEND CREEP DURING FRONTEND DEVELOPMENT:                                     │
│    Frontend is built completely with deterministic client simulations, Zustand         │
│    `localStorage` persistence, and realistic fake latencies. Never allow an agent to   │
│    "helpfully" start creating real API routes, SQLite databases, or live SDK bindings. │
│                                                                                        │
│ 3. SINGLE SOURCE OF TRUTH (DRY DATA):                                                  │
│    All prices, tiers, and features read from `PLANS` in `mock/data.ts`. All numbers    │
│    are formatted via `lib/utils.ts`. Data is never duplicated or hardcoded in JSX.     │
│                                                                                        │
│ 4. REUSE UI PRIMITIVES — NEVER REINVENT:                                               │
│    Always compose from `components/ui/*` (22 Base UI / Aether Glass primitives).       │
│    Never create ad-hoc buttons, native modal dialogs, or unstyled divs.                │
│                                                                                        │
│ 5. RIGOROUS ACCEPTANCE CHECKLISTS:                                                     │
│    Every prompt ends with an explicit, manual and automated verification checklist.    │
│    A phase is not done until all checklist items are verified and `tsc` is clean.      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PROMPT MATRIX & CHRONOLOGICAL OVERVIEW

| # | Prompt File | Phase | Core Focus | Key Deliverables |
|---|---|---|---|---|
| **00** | `00 Prompt (Start)` | **Meta / Setup** | Master roadmap & ground rules | Established phase order (4→5→6→7), stack boundaries, design language |
| **01** | `01 Prompt (v0)` | **Phase 1 (v0)** | Full initial frontend shell | Next.js 16 App Router, React Flow canvas, Aether Glass design tokens, marketing pages |
| **02** | `02 Prompt (AntiGravity)` | **Phase 2** | Bot details & Backtest flow | 4-tab Bot overview (`/app/bots/:id`), Backtest config, Recharts equity curve, Trade log |
| **03** | `03 Prompt (AntiGravity)` | **Phase 2 Patch** | Suspense & Live tab bugfix | Wrapped `useSearchParams` in `<Suspense>`, bot-scoped live positions snapshot |
| **04** | `04 Prompt (AntiGravity)` | **Phase 3** | Legal & Auth flow pages | Terms, Privacy, Risk Disclosure, Refund Policy, password recovery & verify email |
| **05** | `05 Prompt (AntiGravity)` | **Phase 4** | Bug bash & Auth guards | `ConfirmDialog` primitive, styled 404, client auth gate in `AppShell`, unified `PLANS` |
| **06** | `06 Prompt (AntiGravity)` | **Phase 5** | Missing pages & Onboarding | 5-step Onboarding, Presets, Library, 4-bot Compare, Creator Dashboard, Billing & Account subpages |
| **07** | `07 Prompt (AntiGravity)` | **Phase 6** | Deep Customization | `DeepCustomizationDialog`, 8 new `FieldDef`s, LLM registry (`mock/models.ts`), prompt variables |
| **08** | `08 Prompt (AntiGravity)` | **Phase 7** | Storage Normalization | `BotGraph` schema v2, `cloneGraph()`, fixed 8 canvas cloning bugs, JSON import/export |
| **09** | `09 Prompt (AntiGravity)` | **Phase 7.1** | Marketplace Bridge | `useMarketplacePresets()` unified hook, eliminated dead `/marketplace` links |
| **10** | `10 Prompt (AntiGravity)` | **Phase 8** | Polish & Live Activity | Purged 174 unused imports, enforced strict TypeScript, live store activity logging, DevPanel gating |
| **11** | `11 Prompt (AntiGravity)` | **Phase 9** | Final Punch List & Freeze | Added persistent "Paper Trading Only" banner on Live monitors, corrected search placeholders |

---

## 3. DEEP-DIVE BREAKDOWN OF EACH PROMPT

---

### 3.0 Prompt 00 (Start) — Phases 4–7 Master Plan & Ground Rules
*File:* [`Prompts/00 Prompt (Start)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/00%20Prompt%20%28Start%29)  
*Phase:* Meta / Ground Rules

#### Motivation & Context
Written after reviewing the initial v0 build, Phase 2, and Phase 3. It identified that feeding massive, unstructured prompts to AI coding assistants leads to regressions, half-finished features, and broken state. It established the discipline of narrow, bounded phase prompts executed one at a time.

#### Core Mandates & Rules
1. **Strict Serial Progression:** Phase 4 (Bug Bash) → Phase 5 (Missing Pages) → Phase 6 (Node Customization) → Phase 7 (Storage Normalization).
2. **Absolute Ban on Backend Creep:** Prohibited agents from introducing real databases, API routes, or real payment webhooks.
3. **Design System Discipline ("Aether Glass"):** Frosted glass surfaces (`glass`, `glass-chrome`), Apple-style pill geometries, semantic color tokens (`text-profit`, `text-loss`, `text-warn`, `text-brand`), and universal INR (`₹`) formatting.
4. **Data Model Integrity:** `mock/data.ts` and `mock/layers.ts` established as foundational datasets for all downstream work.

---

### 3.1 Prompt 01 (v0) — Initial Frontend Architecture & The Loom Foundation
*File:* [`Prompts/01 Prompt (v0)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/01%20Prompt%20%28v0%29)  
*Phase:* Phase 1 (v0)

#### Motivation & Context
The founding build prompt for the entire application. It specified building the complete frontend interface for AETHER as an Apple-grade, glassmorphic visual trading agent builder.

#### Key Achievements
- **Framework & Foundation:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 with CSS custom properties in `app/globals.css`.
- **The Loom Canvas:** Initial integration of `@xyflow/react` (React Flow) featuring 12 translucent colored layer bands, draggable node cards, input/output ports, minimap, and inspector panel.
- **Design System Tokens:** Light/dark theme variables, Apple pill CTA buttons, custom blur filters (`backdrop-filter: blur(20px)`), and thin 1.5px `lucide-react` iconography.
- **Marketing Surface:** Landing page (`/`), How it Works (`/how-it-works`), Pricing (`/pricing`), and Public Marketplace preview (`/marketplace`).
- **Simulated Latency & Persistence:** Integrated Zustand with `persist` middleware to `localStorage` and created `fakeLatency` helpers.

#### Non-Goals & Deferrals
No real database, no live WebSocket exchange feeds, no real authentication or JWTs.

---

### 3.2 Prompt 02 (AntiGravity) — Phase 2: Bot Detail Experience & Backtest Simulator
*File:* [`Prompts/02 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/02%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 2

#### Motivation & Context
The v0 build had a major gap: clicking a bot simply redirected to the builder, and there was no way to view backtest results or bot settings. The product's core "aha moment" (assembling and backtesting a strategy) was incomplete.

#### Key Achievements
- **Bot Overview Hub (`/app/bots/[botId]`):** Built the 4-tab hub containing Overview, Backtests, Live, and Settings tabs with shared `BotHeader`.
- **Backtest Configuration State Machine (`/app/bots/[botId]/backtest`):** Form with date pickers, symbol selection, capital, slippage, seed, and test types (`historical`, `walk-forward`, `monte-carlo`, `paper`, `ab`), with live credit cost calculation.
- **Streaming Progress Bar:** Simulated 2.5–4 second execution with streaming console logs.
- **Results Dashboard (`/app/bots/[botId]/backtest/[runId]`):**
  - 8-metric grid (Total Return, Win Rate, Max Drawdown, Sharpe, Trades, Avg R, Profit Factor, Exposure).
  - Themed Recharts `AreaChart` with dual series (Equity vs. Benchmark) and glass tooltips.
  - Sortable, filterable Trade Log table with P&L badges.
  - Layer contribution breakdown ("Risk Gate blocked 12 trades, avoided loss ₹4,500").
  - Self-learning insights panel displaying candidate rules and post-mortems.
- **Live State Mutation:** "Promote to Live" button actively flipped bot status in `useWorkspace`.

---

### 3.3 Prompt 03 (AntiGravity) — Phase 2 Patch: Suspense Boundaries & Live Tab Scoping
*File:* [`Prompts/03 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/03%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 2 Patch

#### Motivation & Context
Code review of Phase 2 revealed a Next.js App Router build risk with unsuspended `useSearchParams()` and a generic static placeholder on the bot's Live tab.

#### Key Achievements
- **`<Suspense>` Boundary Wrapping:** Refactored `app/app/bots/[botId]/page.tsx` into an inner component wrapped in `<Suspense fallback={<BotDetailSkeleton />}>`.
- **Bot-Scoped Live Tab:** Rewired `components/bot/live-tab.tsx` to deterministically slice `OPEN_POSITIONS` and `LIVE_LOG_TEMPLATES` using `hashString(bot.id)` so each bot displays stable, personalized telemetry.

---

### 3.4 Prompt 04 (AntiGravity) — Phase 3: Legal Architecture & Auth Flows
*File:* [`Prompts/04 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/04%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 3

#### Motivation & Context
A trading platform requires robust risk disclosures and complete authentication screens to feel professional and legally sound (especially for Razorpay merchant verification).

#### Key Achievements
- **Legal Layout & 4 Full Documents:**
  - `app/legal/terms/page.tsx` (IP terms, 80% creator revenue share, Indian jurisdiction).
  - `app/legal/privacy/page.tsx` (Strategy data non-disclosure guarantee).
  - `app/legal/risk-disclosure/page.tsx` (Explicit paper trading by default, simulation caveats).
  - `app/legal/refund-policy/page.tsx` (7-day window, credit non-expiration).
- **Client Auth Flow Pages:** `/forgot-password`, `/reset-password` (token-aware), and `/verify-email`.
- **Site Footer & Login Wiring:** Cross-linked all legal pages into `SiteFooter` and wired "Forgot password?" into `/login`.

---

### 3.5 Prompt 05 (AntiGravity) — Phase 4: Bug Bash, Dead Links & Real Auth Guards
*File:* [`Prompts/05 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/05%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 4

#### Motivation & Context
An audit of the codebase revealed several critical UX bugs: dead marketing links pointing to nonexistent `/builder` and `/marketplace` routes, three conflicting sets of plan prices across different pages, native browser `confirm()` popups, and unauthenticated access to `/app/*`.

#### Key Achievements
- **Styled 404 Page (`app/not-found.tsx`):** Centered glass layout with inline search palette trigger.
- **`ConfirmDialog` Primitive:** Created accessible, glass-themed confirmation modal in `components/ui/confirm-dialog.tsx`, eradicating all native `confirm()` calls.
- **Client-Side Auth Guards:** Built `AppShell` in `components/app/app-shell.tsx` that automatically redirects unauthenticated users from `/app/*` to `/login`.
- **Pricing Unification:** Tied `/pricing`, `/app/billing`, and homepage pricing teasers strictly to `PLANS` and `PLAN_COMPARISON` in `mock/data.ts`.
- **Settings Persistence:** Created a dedicated `profile` slice in `useSession` ensuring user name/bio edits survive page reloads and update the global topbar.
- **Notification Dismissal:** Added `dismissNotification(id)` to `useWorkspace` and wired individual trash actions in `/app/notifications`.

---

### 3.6 Prompt 06 (AntiGravity) — Phase 5: Missing Pages, Onboarding & Ecosystem
*File:* [`Prompts/06 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/06%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 5

#### Motivation & Context
Many datasets in `mock/data.ts` (e.g. `MY_PRESETS`, `INVOICES`, `API_KEYS`, `DOC_SECTIONS`, `BLOG_POSTS`) had zero UI consumers, and multiple sitemap routes remained unbuilt.

#### Key Achievements
- **5-Step Onboarding Wizard (`/onboarding/*`):**
  - Step 1 (`/welcome`): Beginner/Intermediate/Advanced selector.
  - Step 2 (`/start`): Template vs. Blank canvas picker.
  - Step 3 (`/tour`): Interactive spotlight overlay pointing to real DOM elements (`data-tour`).
  - Step 4 (`/first-node`): Micro-task watching canvas node insertions.
  - Step 5 (`/done`): Confetti celebration and redirect to first backtest.
- **Ecosystem Pages Built:**
  - `/app/presets` & `/app/presets/[presetId]`: Private preset manager with duplicate and version history.
  - `/app/library` & `/app/library/[componentId]`: Browsable 68-component catalog with documentation.
  - `/app/compare`: 4-bot overlay equity chart and side-by-side metric matrix.
  - `/app/marketplace/publish/[botId]`: 5-step publish wizard enforcing backtest proof.
  - `/app/creator/dashboard`: Sales tracking, revenue metrics, and simulated payout requests.
  - `/app/billing/*`: Subpages for `/plans`, `/topup`, `/history` (with client-side receipt downloads), and `/payment-methods`.
  - `/app/account/*`: Subpages for `/profile`, `/security`, `/notifications`, `/api-keys` (Pro gated), and `/danger-zone` (full JSON export and account reset).
  - `/app/help` & `/app/search`: Searchable FAQ and full-page global fuzzy search.
  - `/docs/[slug]` & `/blog/[slug]`: Markdown-styled documentation and article readers.
  - `/app/builder/[botId]/version/[versionId]`: Read-only canvas version preview and restore.

---

### 3.7 Prompt 07 (AntiGravity) — Phase 6: Node System Overhaul & Deep Customization
*File:* [`Prompts/07 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/07%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 6

#### Motivation & Context
Nodes previously only had a flat list of basic sliders. Real quantitative and LLM trading agents require rich parameterization: model/provider selection, editable system prompts, code snippets, weighted lists, and API credentials.

#### Key Achievements
- **Expanded `FieldDef` Union (8 New Variants):** Added `model-select`, `prompt`, `code`, `json`, `key-value`, `weighted-list`, `credential`, and `dataset-ref`.
- **LLM Provider Registry (`mock/models.ts`):** Defined hosted models (OpenAI GPT-5, Claude 3.5/Opus, Gemini Pro/Flash, DeepSeek V3/R1, Qwen 72B) and local Ollama (`http://localhost:11434`) endpoints.
- **Unified Field Renderer (`components/builder/field-renderer.tsx`):** Single, centralized switch statement for rendering all basic and advanced fields across Inspector and Modals.
- **Deep Customization Modal (`components/builder/deep-customization-dialog.tsx`):**
  - Full-screen modal with 4 tabs: Configuration, Model & Prompt, Documentation, and Advanced/Reset (JSON export/import).
- **Dynamic Prompt Variable Mapping:** Computed incoming canvas edges dynamically to populate `{{variable}}` chips in prompt templates, with lint warnings in `lib/validate.ts` for orphaned variables.
- **Backward Compatibility:** Ensured old saved bots merge `defaultConfig(comp)` automatically when loaded.

---

### 3.8 Prompt 08 (AntiGravity) — Phase 7: Graph & Storage Normalization (`BotGraph` v2)
*File:* [`Prompts/08 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/08%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 7

#### Motivation & Context
A deep code audit uncovered 8 critical data-loss bugs: sticky notes and section frames were only supported on `Bot` and were silently stripped during preset saving, forking, duplicating, publishing, and version restoration. Furthermore, publishing captured zero graph data.

#### Key Achievements
- **Canonical `BotGraph` Schema (v2):** Embedded `{ nodes, edges, notes, frames, schemaVersion }` universally across `Bot`, `BotVersion`, `Preset`, `MyPreset`, and `PublishedPreset`.
- **`cloneGraph()` Engine ([`lib/graph-utils.ts`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Codebase/lib/graph-utils.ts)):** Deep-clones nodes, edges, notes, and frames with new unique slug IDs while preserving pixel positions, configurations, and edge topologies identically.
- **Bug Fixes:**
  - Closes Bug #1–#4: Notes/frames now survive preset saving, forking, and duplicating.
  - Closes Bug #5: Marketplace publishing now captures the complete `BotGraph`.
  - Closes Bug #6–#7: Version snapshots and restoration now preserve complete canvas annotations.
  - Closes Bug #8: Schema-version-aware migration (`migrateGraph()`) replaced brittle shape-sniffing.
- **JSON Export / Import Utility:** Added `exportBot()` and `parseBotImport()` with structural validation for file sharing.

---

### 3.9 Prompt 09 (AntiGravity) — Phase 7.1: Publish-to-Marketplace Bridge & Route Fixes
*File:* [`Prompts/09 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/09%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 7.1

#### Motivation & Context
While Phase 7 captured graph data during publishing, published presets were stored only in `publishedPresets` (creator view) while marketplace pages read exclusively from static `MARKETPLACE_PRESETS`, making newly published strategies invisible in the marketplace.

#### Key Achievements
- **Unified Marketplace Hook (`useMarketplacePresets()`):** Created selector in `lib/workspace-store.ts` that dynamically merges user-published presets with static seed presets.
- **Universal Consumption:** Updated `/marketplace`, `/app/marketplace`, `/app/compare`, search index, and detail pages to consume `useMarketplacePresets()`.
- **Public Link Fixes:** Corrected remaining marketing links (`site-nav.tsx`, `site-footer.tsx`, `closing-cta.tsx`, `marketplace-teaser.tsx`) to point to the public `/marketplace` instead of the gated `/app/marketplace`.

---

### 3.10 Prompt 10 (AntiGravity) — Phase 8: Polish Pass, Creator Discoverability & Live Feed
*File:* [`Prompts/10 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/10%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 8

#### Motivation & Context
A rigorous post-Phase 7 audit identified leftover native `confirm()` calls, 174 unused imports, TypeScript build error suppression flags, unreachable Creator Dashboard navigation, and static dashboard activity feeds.

#### Key Achievements
- **Code Cleanliness & Build Hardening:**
  - Removed all native `confirm()` calls (fixed backtests tab delete handler).
  - Purged 174 unused imports and variables across 49 files.
  - Removed `typescript: { ignoreBuildErrors: true }` from `next.config.mjs`, enforcing strict 0-error builds.
- **DevPanel Environment Gating:** Gated `Ctrl+Shift+D` panel behind `process.env.NEXT_PUBLIC_ENABLE_DEV_PANEL` / `NODE_ENV !== 'production'`.
- **Small-Screen Canvas Fallback:** Added desktop-primary banner on `/app/builder` for viewports <1024px.
- **Creator Dashboard Discoverability:** Added conditional sidebar link and Presets page cross-link when `publishedPresets.length > 0`.
- **Live Activity & Notification Feeds:** Wired `pushActivity()` and `pushNotification()` in `useWorkspace` across 5 real user actions (backtest complete, node unlocked, preset published, bot promoted to live, credits purchased).

---

### 3.11 Prompt 11 (AntiGravity) — Phase 9: Final Punch List & Frontend Freeze
*File:* [`Prompts/11 Prompt (AntiGravity)`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Prompts/11%20Prompt%20%28AntiGravity%29)  
*Phase:* Phase 9

#### Motivation & Context
The final frontend review before freezing the UI. Verified all Phase 8 acceptance criteria and resolved the last remaining compliance and copy discrepancies.

#### Key Achievements
- **Persistent Paper Trading Warning Banner:** Added non-dismissable banner to `/app/live` and bot Live tabs: *"Paper trading only — no real funds are being used"*.
- **Accurate Library Copy:** Corrected library search placeholder from `"Search 100+ nodes"` to `"Search 60+ components"` to match actual component catalog size (68 components).
- **Cleaned Stale Comments:** Removed outdated `TODO` comments in marketplace cards.
- **Onboarding Copy Alignment:** Aligned beginner onboarding expectations with node inspector presentation.

---

## 4. EVOLUTIONARY MILESTONES & ARCHITECTURAL SHIFTS

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ARCHITECTURAL EVOLUTION OF AETHER                                 │
├────────────────────────────┬─────────────────────────────┬───────────────────────────────────────┤
│ Domain                     │ Initial State (v0 / Phase 1)│ Final Frozen State (Phase 9)          │
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Canvas Data Structure      │ Loose nodes & edges arrays  │ Canonical `BotGraph` (v2) with notes, │
│                            │ (notes/frames dropped)      │ frames, and schema migrations         │
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Node Configuration Depth   │ 7 flat slider/text inputs   │ 15 field types, LLM provider registry,│
│                            │                             │ Deep Customization modal, prompt vars │
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Route Coverage             │ ~10 core pages, stubs       │ 59 fully functional client-side routes│
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Marketplace Architecture   │ Hardcoded static array      │ Unified `useMarketplacePresets()` hook│
│                            │ (published bots vanished)   │ merging user-published strategies     │
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Authentication & Security  │ Unenforced mock boolean     │ `AppShell` client auth guard, token-   │
│                            │                             │ aware password reset, verify email    │
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Modal & Dialog System      │ Mix of divs & native confirm│ 100% Base UI `Dialog` & `ConfirmDialog│
├────────────────────────────┼─────────────────────────────┼───────────────────────────────────────┤
│ Type Safety & Linting      │ Build errors ignored in config│ Strict TypeScript (0 errors, 0 unused)│
└────────────────────────────┴─────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. IMMUTABLE AGENT RULES FOR FUTURE DEVELOPMENT

When interacting with or extending this codebase, any AI agent must strictly abide by these rules:

1. **Do Not Touch Frontend Core Unless Explicitly Prompted:** The frontend is frozen at Phase 9. Do not re-architect existing routes or restyle components.
2. **Preserve `BotGraph` Schema v2:** Never alter how graphs are cloned, stored, or exported without updating `CURRENT_GRAPH_SCHEMA_VERSION` and `migrateGraph()`.
3. **Respect the Quantum Edge Backend Blueprint:** When building backend execution, reference [`Iteration 101/MASTER_BLUEPRINT.md`](file:///home/neeraj/Desktop/Coding/Trading/My%20Trading%20Bot/Iteration%20101/MASTER_BLUEPRINT.md) (Python LangGraph, 4-stage validation, OCULUS visual reader, CCXT HERMES gateway).
4. **Follow INR (₹) Formatting & Semantic Colors:** Never hardcode currency symbols or raw hex green/red colors.
5. **No Direct `localStorage` Manipulation:** Always use the Zustand stores (`useWorkspace`, `useSession`, `useBuilder`).

---
*End of Master Prompt Chronicle & Workways Compendium — AETHER Project*
