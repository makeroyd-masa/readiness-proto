import { useEffect, useState } from 'react';
import type { Profile } from '../domain/profile';
import { applyAnswer } from '../engine/engine';
import { scoreProfile } from '../domain/scoring';
import { nextSteps } from '../domain/steps';
import { SamBubble, Scorecard } from './common';
import { printSeminarCard } from './print';
import { finishUrl, qrSvg, resumeCode, resumeUrl } from './resume';

/**
 * Seminar mode (PRD §5.2): on a shared tablet, ~60–90s. The lead taps TWO
 * non-sensitive questions (household, worry) and lands on the real customer
 * payoff — a personalized readiness reveal — with a "take it home" path.
 *
 * Take-home model: an on-screen simulated "Text me my link" (the SMS link has the
 * follow-up ID appended → auto-login), plus the generic QR on the pre-printed card
 * (the agent hand-writes the follow-up ID; the lead enters it after scanning). No
 * printing happens in-seminar for the foreseeable rollout — the card is shown only
 * via a small proto demo link. Guardrail: no medications/diagnoses/cognitive/mobility
 * detail on the shared screen or asked aloud (§5.2, §13).
 */
const HOUSEHOLD_PHRASE: Record<string, string> = {
  solo: 'a one-person household',
  couple: 'a couple',
  caregiver: 'caring for an aging parent',
  kids: 'a family with kids',
};
const WORRY_PHRASE: Record<string, string> = {
  info: 'no one having the right information',
  chaos: 'panic or getting separated',
  cost: 'the cost of emergency transport',
  distance: 'being far from care',
};
const MOCK_PHONE = '(555) 012-3456';

export function SeminarMode({ profile, commit, track }: { profile: Profile; commit: (p: Profile) => void; track: (t: string, d?: Record<string, unknown>) => void }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [qr, setQr] = useState<string>(''); // generic card QR, for the proto "view printed card" link
  const [phone, setPhone] = useState(MOCK_PHONE);
  const [sent, setSent] = useState(false);

  const code = resumeCode(profile);

  // Pre-render the (generic) card QR once we reach the reveal, so the proto print
  // window can open synchronously on click without tripping pop-up blockers.
  useEffect(() => {
    if (step === 2) qrSvg(finishUrl()).then(setQr);
  }, [step]);

  function answer(field: string, value: string, nextStep: 1 | 2) {
    const next = applyAnswer({ ...profile, tier1: { ...profile.tier1, entryContext: 'seminar' } }, field, value);
    commit(next);
    track('answer', { mode: 'seminar', field, value });
    setStep(nextStep);
  }

  if (step === 2) {
    const score = scoreProfile(profile);
    const steps = nextSteps(profile);
    const household = HOUSEHOLD_PHRASE[profile.tier1.householdType ?? 'solo'] ?? 'your household';
    const worry = WORRY_PHRASE[profile.tier1.topWorry ?? 'info'] ?? 'what matters most';

    return (
      <div className="stage">
        <SamBubble>
          You're {household}, most worried about {worry}. Based on that, here's where your household stands today —
          and the first steps that matter most for you.
        </SamBubble>

        <Scorecard score={score} />

        <div className="section-h">Your top 3 next steps</div>
        {steps.map((s, i) => (
          <div className="semstep" key={s.id}>
            <span className="semnum">{i + 1}</span>
            <div>
              <div className="semtitle">{s.title}</div>
              <div className="semdesc">{s.desc}</div>
            </div>
          </div>
        ))}

        <div className="takehome">
          <div className="th-h">Finish your plan at home</div>
          {sent ? (
            <div className="th-sent">
              ✓ Sent to <strong>{phone}</strong>. Tap the link on your phone to pick up right where you left off.
              <div className="th-link">{resumeUrl(code)}</div>
            </div>
          ) : (
            <>
              <p className="th-copy">We'll text you a link that opens your plan on your phone — already signed in, ready to finish in about five minutes.</p>
              <label className="th-label" htmlFor="phone">Send to</label>
              <div className="th-row">
                <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setSent(true);
                    track('sms_link_sent', { code });
                  }}
                >
                  Text me my link
                </button>
              </div>
            </>
          )}
          <div className="th-id">
            Your follow-up ID: <strong>{code}</strong>
            <span className="th-idnote"> — your MASA agent writes this on your card; enter it if you scan the card's QR.</span>
          </div>
        </div>

        <button className="protolink" disabled={!qr} onClick={() => { printSeminarCard(qr); track('seminar_card_printed', { code }); }}>
          {qr ? 'View printed card (proto)' : 'Preparing card preview…'}
        </button>

        <div className="footdisc">
          SAM offers guidance, not medical advice. In an emergency, always call 911.
        </div>
      </div>
    );
  }

  return (
    <div className="stage">
      <div className="seminar">
        <h2>Household Readiness</h2>
        <div className="sub">Two quick questions — about a minute — then your personalized plan.</div>

        {step === 0 && (
          <>
            <div className="bigq">Who's in your household?</div>
            <div className="bigopts">
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('householdType', 'solo', 1)}>Just me</button>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('householdType', 'couple', 1)}>Me and my spouse/partner</button>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('householdType', 'caregiver', 1)}>I care for an aging parent</button>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('householdType', 'kids', 1)}>Family with kids</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="bigq">What worries you most in an emergency?</div>
            <div className="bigopts">
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('topWorry', 'info', 2)}>No one would have the right info</button>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('topWorry', 'chaos', 2)}>We'd panic or get separated</button>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('topWorry', 'cost', 2)}>The cost of transport</button>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => answer('topWorry', 'distance', 2)}>Being far from care</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
