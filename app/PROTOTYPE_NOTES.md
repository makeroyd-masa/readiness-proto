# SAM Household Readiness Check — Rebuild Prototype (v2)

Internal, throwaway prototype built from scratch per **PRD Revision 2 §19**. It is not a
port of the v1 HTML; it demonstrates the revised model on real, deterministic rails.

## Run it

```
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npx tsx verify.ts  # headless acceptance checks (PRD §19.7)
```

Use the grey **dev bar** at the top to switch delivery mode (standard / seminar / returning),
toggle **member / prospect / unknown** (self-declared in this prototype), and **reset** the
persisted profile.

## What this prototype demonstrates (and the v2 decisions it encodes)

| Area | Decision encoded |
|---|---|
| Differentiation | Coverage is **out of the score** (§8); the artifact is **never gated** (§4). |
| Profile spine | Persisted `Family Readiness File` in `localStorage`, keyed by an anonymous session id (§6.2, §19.1). No in-memory-only state (fixes v1 §18). |
| Two-tier data | Tier-1 personalization captured freely; Tier-2 sensitive fields **consent-gated**, default *finish later on your device* (§7). |
| Scoring | Family-controlled dimensions only, pure/reproducible, **band-first** with % secondary, never 100% (§8). |
| Artifact | One profile → three forms: living file (in-app), PDF snapshot, wallet/fridge card (§10). Real print/save. |
| Coverage module | Optional, education-first; **prospect** (questions → offer) vs **member** (reference) variants; the v1 upsell line is removed (§9). |
| Modes | Standard, agent-operated **seminar** (no sensitive data on screen), **returning** change-detection (§5). |
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
src/content/    flow.ts (~9 stages as data) · evidence.ts (Ready.gov) · coverage.ts
src/engine/     engine.ts (deterministic walker) · guards.ts (dead-branch check)
src/store/      profileStore.ts (persistence + event log)
src/ui/         App.tsx · StandardMode · SeminarMode · ReturningMode · Result · common · print
verify.ts       headless §19.7 acceptance checks
```

Content is authored data; the engine is code (§19.1). Adding a flow = adding data, not
primitives.
