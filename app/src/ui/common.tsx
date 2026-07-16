import type { ReactNode } from 'react';
import type { Score } from '../domain/scoring';

/** MASA "+" mark (programmatic, no logo asset). Valid xmlns (v1 had a mangled one). */
export function Mark({ color = '#FFFFFF', size }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <path
        fill={color}
        d="M24.5 3.5a4 4 0 0 0-4-4h-1a4 4 0 0 0-4 4v8a4 4 0 0 1-4 4h-8a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h8a4 4 0 0 1 4 4v8a4 4 0 0 0 4 4h1a4 4 0 0 0 4-4v-8a4 4 0 0 1 4-4h8a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4h-8a4 4 0 0 1-4-4z"
        transform="translate(0.5 0.5)"
      />
    </svg>
  );
}

export function Avatar() {
  return (
    <div className="avatar">
      <Mark />
    </div>
  );
}

/** SAM message bubble. `html` renders limited inline markup already in our copy. */
export function SamBubble({ children }: { children: ReactNode }) {
  return (
    <div className="sammsg">
      <Avatar />
      <div className="bubble">{children}</div>
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="usermsg">
      <div className="ub">{text}</div>
    </div>
  );
}

/** The readiness-meter spine (PRD §6.2 the spine). Band-first, % secondary. */
export function ReadinessMeter({ score, hint }: { score: Score | null; hint?: string }) {
  const pct = score?.displayPct ?? 0;
  const band = score ? `${score.band} · ${pct}%` : '—';
  return (
    <div className="spine">
      <div className="row">
        <span className="lbl">Your Family Readiness File</span>
        <span className="band">{band}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="hint">{hint ?? 'SAM keeps this updated as things change.'}</div>
    </div>
  );
}
