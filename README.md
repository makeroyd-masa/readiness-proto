# SAM Household Readiness Check — prototype

Internal, throwaway prototype of MASA/SAM's Household Readiness Check (PRD v2). Vite +
React + TypeScript, `localStorage` persistence, **synthetic data only**. Carries a
persistent *internal prototype — not for distribution* banner.

**Live (GitHub Pages):** https://makeroyd-masa.github.io/readiness-proto/

## Run locally

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npx tsx verify.ts  # 21 headless acceptance checks (PRD §19.7)
```

Use the grey **dev bar** to switch mode (standard / seminar / returning), toggle
member / prospect / unknown, and reset the stored profile. See `app/PROTOTYPE_NOTES.md`
for the v2 decisions this build encodes.

## The seminar card loop

`docs/masa_seminar_blank_stock_card_front_back.png` is the pre-printed seminar leave-behind:
a fill-by-hand household emergency card (front) and a "finish your plan at home" QR +
resume code (back). In the app:

- **Seminar mode** prints this exact card (front + back). The back QR encodes
  `…/readiness-proto/?resume=CODE`, so it points at this deployed app.
- Opening the app with **`?resume=CODE`** (i.e. scanning that QR) lands on the
  *Finish your plan at home* flow and continues into the full readiness check.

## Deployment

Push to `main` → `.github/workflows/deploy.yml` builds `app/` and publishes `app/dist`
to GitHub Pages (source: GitHub Actions).

## Note on excluded files

The internal PRD `.docx` files under `docs/` are git-ignored (`.gitignore`) so they stay
out of this public repo. The seminar-card mock-up PNG is kept. Adjust `.gitignore` if you
want different visibility.
