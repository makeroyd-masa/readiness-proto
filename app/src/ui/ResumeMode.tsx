import { useState } from 'react';
import { Mark } from './common';
import { getCodeSnapshot } from '../store/codeStore';

/**
 * The home end of the seminar loop (PRD §5.2). Two ways in, both to the same
 * mobile-responsive experience:
 *  - `autologin` — reached via the SMS link `?resume=CODE`. The follow-up ID is
 *    in the URL, so the lead is recognized and just continues.
 *  - `enterId` — reached via the generic QR on the pre-printed card (`?finish=1`).
 *    The lead types the follow-up ID the agent hand-wrote on their card.
 *
 * Honest-prototype note: there is no backend to restore a seminar-started profile
 * from another device, so this continues into a fresh full check rather than
 * pretending to rehydrate server state. The code is shown/entered as the token it is.
 */
export function ResumeMode({
  variant,
  code,
  onContinue,
}: {
  variant: 'autologin' | 'enterId';
  code?: string;
  onContinue: (code: string) => void;
}) {
  const [entered, setEntered] = useState('');
  const isEnter = variant === 'enterId';
  const trimmed = entered.trim();
  const found = isEnter && trimmed.length > 0 ? Boolean(getCodeSnapshot(trimmed)) : false;
  const canContinue = isEnter ? trimmed.length > 0 : true;

  return (
    <div className="stage">
      <div className="intro">
        <div className="avatar" style={{ width: 46, height: 46, margin: '6px auto 16px' }}>
          <Mark size={26} />
        </div>
        <h1>Finish your plan at home</h1>
        <p>
          You started your Family Readiness File at the seminar. Let's finish the last two private questions — about
          five minutes — to get your full plan, plus what to ask about emergency transport coverage.
        </p>

        {isEnter ? (
          <div className="resume-entry">
            <label htmlFor="followup">Enter your follow-up ID</label>
            <div className="resume-hint">It's the code your MASA agent wrote on your card.</div>
            <input
              id="followup"
              value={entered}
              onChange={(e) => setEntered(e.target.value.toUpperCase())}
              placeholder="e.g. 4F9A2C7B"
              autoCapitalize="characters"
              autoComplete="off"
            />
            {trimmed.length > 0 &&
              (found ? (
                <div className="resume-ok">✓ Found your seminar answers — we'll pick up where you left off.</div>
              ) : (
                <div className="resume-warn">We couldn't find that code on this device. You can still continue — we'll start a fresh check.</div>
              ))}
          </div>
        ) : (
          <div className="previewmeter">
            <div className="t">Welcome back — we've got your plan</div>
            <div className="pill-row">
              <span className="pill">Follow-up ID · {code}</span>
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={!canContinue} onClick={() => onContinue(isEnter ? entered.trim() : (code ?? ''))}>
          Continue my plan →
        </button>
        <div className="disc">
          Helping a parent? You can finish Mom or Dad's plan with them from here too. SAM offers guidance, not
          medical advice. In an emergency, always call 911.
        </div>
      </div>
    </div>
  );
}
