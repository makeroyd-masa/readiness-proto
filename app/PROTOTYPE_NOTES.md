# SAM Household Readiness Check — Rebuild Prototype (v3)

Internal, throwaway prototype built from scratch per **PRD Revision 2 §19**, then expanded per
**Revision 3** (`docs/SAM_Household_Readiness_Requirements_v3.docx`) from an emergency-response
check into a broader **household-resilience** model. It demonstrates the revised model on real,
deterministic rails.

## What Revision 3 added

- **Three sensitivity tiers (P / M / F)** — Tier P is shareable (seminar screen + agent view);
  Tier M (advocacy, medications) and Tier F (financial runway) are home-only and never rendered
  on shared/agent surfaces (`FIELD_TIER` in `domain/valueSets.ts`, enforced + tested).
- **Expanded intake** — an aging-parent flag decoupled from household type (`caregiver` removed
  as a composition); who-to-call and who-takes-charge promoted to three-level scenario
  questions; new legal-paperwork, financial-runway, and long-term-care questions.
- **Six scored dimensions** — People & roles gains a documented-vs-informal depth; **Financial
  resilience** and **Long-term-care planning** added (LTC is the personalized fifth for
  aging-parent / multigen households). Coverage still unscored.
- **Anti-upsell discipline** — products appear only in optional, post-artifact education modules;
  a build-time **product-neutrality scan** (`verify.ts` check 13, NF-10) fails on any product
  term in a scored gap, step title, or question copy.
- **Expanded artifact** — living file + PDF gain decision-authority, financial, and LTC sections
  (wallet card stays lean); summary reframed "emergency card" → "household resilience plan".

## Run it

```
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npx tsx verify.ts  # headless acceptance checks (PRD §19.7)
```

Each surface is its own **page** (the old dev-bar mode switcher is gone):

| Path | Surface |
|---|---|
| `/` | Demo menu linking the four surfaces |
| `/in-app` | Consumer "SAM" app — full flow, styled to match `masa-sam-advocate` |
| `/seminar-view` | Seminar kiosk — non-medical 1st half, big buttons |
| `/agent-view` | Agent tablet — look up a lead by code, see answers, track completion |
| `/returning` | Finish-at-home — enter code → medical 2nd half → summary |

Routing is `react-router-dom` (`BrowserRouter`, basename from the Vite `base`). GitHub Pages has
no SPA rewrite, so a Vite plugin copies `dist/index.html` → `dist/404.html` and deep-link
refreshes resolve. `memberStatus` defaults to `unknown` (the toggle is gone).

## The two-half flow and the seminar code loop

The intake is authored in `content/flow.ts` as two halves separated by a `half_break` node:

- **1st half — non-medical** (`household → role → geo → inventory → worry`). Safe for the
  shared seminar screen (§5.2, §13).
- **2nd half — medical** (`vulnerability → medications`). Completed privately at home; never
  shown on the shared screen. The medications question is structured (`medicalNeeds`) and
  **feeds the Emergency-information score**.

**Standard** mode walks both halves end-to-end (the break is just a one-line transition).
**Seminar** mode walks only the 1st half (data-driven from the flow, big-button), reveals a
preliminary score, and offers a "text me my link" take-home. It saves the lead's 1st-half
answers under a short **code** (`store/codeStore.ts`).

The code is the spine of the sales loop:
- **Agent** mode (agent tablet, demo) lists leads by code, shows their non-medical answers for
  a warm intro, lets the agent tie a code → attendee name, and flips to *completed* when the
  lead finishes at home.
- **Finish-at-home** (`?resume=CODE` SMS link, or `?finish` → enter the card code) looks the
  code up, restores the 1st-half answers, and resumes at the **medical half**.

The summary (`Result.tsx`) makes the three previously-alluded actions real via `Tools.tsx`:
**People & roles** (add contacts + name a decision-maker), **Go-bag + med supply** (checklist),
and **Holistic household plan** (assembles everything → `printHouseholdPlan`). A simulated
**Download-the-app** CTA marks the code completed. Each tool's writes lift the score.

> **Code store fidelity:** the store is `localStorage` keyed by code — it demonstrates the full
> mechanic **within one browser**. True cross-device (kiosk → the lead's own phone) is the one
> gap the real backend closes later; it swaps in behind `store/codeStore.ts`.

## What this prototype demonstrates (and the v2 decisions it encodes)

| Area | Decision encoded |
|---|---|
| Differentiation | Coverage is **out of the score** (§8); the artifact is **never gated** (§4). |
| Profile spine | Persisted `Family Readiness File` in `localStorage`, keyed by an anonymous session id (§6.2, §19.1). No in-memory-only state (fixes v1 §18). |
| Two-tier data | Tier-1 personalization captured freely; Tier-2 sensitive fields **consent-gated**, default *finish later on your device* (§7). |
| Scoring | Family-controlled dimensions only, pure/reproducible, **band-first** with % secondary, never 100% (§8). |
| Artifact | One profile → three forms: living file (in-app), PDF snapshot, wallet/fridge card (§10). Real print/save. |
| Coverage module | Optional, education-first; **prospect** (questions → offer) vs **member** (reference) variants; the v1 upsell line is removed (§9). |
| Modes | Standard (end-to-end), agent-operated **seminar** (non-medical 1st half only, no sensitive data on screen), **agent** tablet view (code → lead answers → completion), **returning** change-detection (§5). |
| Seminar loop | A short **code** carries the 1st-half answers across kiosk → agent tablet → finish-at-home (simulated backend in `store/codeStore.ts`). |
| Dead-branch fix | All enum values live in `domain/valueSets.ts`; `engine/guards.ts` fails the build on any branch/option outside its value-set (§18, §19.2). |

## Deliberate scope limits (agreed defaults — throwaway internal build)

- **Synthetic data only, no real PHI.** Tier-2 consent is modeled as UX + profile
  structure; persistence is `localStorage`. A server-backed, encrypted store swaps in
  behind `store/profileStore.ts`. Not HIPAA-hardened — that's out of scope here.
- **Evidence layer = Ready.gov / FEMA**, cited with real `source_url` + attribution
  (`content/evidence.ts`). Mayo is a future drop-in behind the same interface (Appendix D:
  Mayo not yet ingested). v1's fake "Mayo Clinic: …" strings are gone.
- **Content licensing NOT cleared.** FEMA reprint terms ("no alteration") have no MASA
  legal sign-off, so evidence surfaces a short pointer + link to the unaltered source
  rather than reproducing block bodies. The app shows a persistent *internal prototype —
  not for distribution* banner. External release is gated on legal sign-off.
- **Coverage grounding = static Appendix-C stats.** No dependency on the
  `medical-billing-data` `pilot.db`. `content/coverage.ts` exposes a `COVERAGE_DATA_SOURCE`
  indirection marking exactly where the real per-state ambulance-fee / parsed-SBC layer
  would attach. NB: those tables (Family C / E) are described as **not yet built** in that
  repo's Data Completion Addendum — so the "real dollars" differentiation story is not
  demonstrable until they exist.
- **Seams are stubbed:** human handoff and household share are confirmation stubs that log
  the payload; email/SMS delivery is simulated; PDF/print and the wallet card are real
  (browser print → save as PDF). Geo "auto-detect" is a manual select.
- **No LLM.** Free-text is a later phase (§12); the flow is rails-only, as scoped.

## Tunable / needs product sign-off later

- **Band cutoffs** (`domain/scoring.ts` `bandFor`) and the **weighting bumps** are a
  defensible first pass, not final product values.
- **Band ordering:** the PRD lists Started / Ready to share / Needs one key update / Ready
  for check-in. Read literally that puts "needs one update" above "ready to share"; this
  build orders them Started → *Needs one key update* → *Ready to share* → *Ready for
  check-in* as the more intuitive ascent. Confirm the intended order.
- **Personalized fifth dimension** per household type (`scoring.ts`) — mapping is a first pass.

## Architecture map

```
src/domain/     valueSets.ts (single source of truth) · profile.ts · nodes.ts (8 types)
                scoring.ts · steps.ts
src/content/    flow.ts (two halves split by half_break) · evidence.ts (Ready.gov) · coverage.ts
src/engine/     engine.ts (deterministic walker) · guards.ts (dead-branch check)
src/store/      profileStore.ts (session id) · codeStore.ts (seminar code → answers)
src/ui/         App.tsx (topbar + <Routes>) · Menu · InApp · SeminarMode · AgentMode · Returning
                StandardMode · BigButtonStage (shared kiosk walker) · Result · Tools · SparkIcon
                useDemoProfile · common · print · theme.css
src/assets/fonts/  self-hosted Poppins + Open Sans (woff2)
verify.ts       headless §19.7 acceptance checks (+ reorder / scored-medical / tool-writes)
```

**Design layers.** The base theme is unchanged for seminar/agent. The
`masa-sam-advocate` look is a **scoped layer** in `theme.css` under `.sam-ui` (in-app, menu,
returning landing + summary): advocate tint tokens, self-hosted **Poppins/Open Sans** under
custom family names (`PoppinsSAM`/`OpenSansSAM`) so seminar/agent keep their exact rendering, the
**SparkIcon** SAM badge, `.sam-msg` bubbles, chip options, and pill buttons. The in-app flow,
engine, scoring, and summary tools are unchanged — only presentation. `BigButtonStage` is the
shared big-button walker used by both the seminar (1st half → `half_break`) and returning
(2nd half `q_vulnerability` → `reveal`). Returning seeds a fixed phase-1 persona (couple, rural,
meds-list + contacts already, worried about cost) since the demo has no real cross-device store.

Content is authored data; the engine is code (§19.1). Adding a flow = adding data, not
primitives.
