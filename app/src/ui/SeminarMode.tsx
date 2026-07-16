import { useEffect, useState } from 'react';
import type { Profile } from '../domain/profile';
import { applyAnswer } from '../engine/engine';
import { nextSteps } from '../domain/steps';
import { printSeminarCard } from './print';
import { qrSvg, resumeCode, resumeUrl } from './resume';

/**
 * Seminar mode (PRD §5.2): AGENT-operated on a shared tablet, 60–90s.
 * The agent taps one or two non-sensitive questions and prints a pre-populated
 * fridge card. Device literacy is the binding constraint, so the card — a real
 * object with the attendee's answers — is the token, not a QR-to-finish promise.
 * Guardrail: no medications/diagnoses/cognitive/mobility detail on the shared
 * screen or requested aloud (§5.2, §13).
 */
export function SeminarMode({ profile, commit, track }: { profile: Profile; commit: (p: Profile) => void; track: (t: string, d?: Record<string, unknown>) => void }) {
  const [agent, setAgent] = useState('');
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [qr, setQr] = useState<string>('');

  const code = resumeCode(profile);

  // Pre-render the QR (async) once we reach the print step, so the print window
  // can open synchronously on click without tripping pop-up blockers.
  useEffect(() => {
    if (step === 2) qrSvg(resumeUrl(code)).then(setQr);
  }, [step, code]);

  function answer(field: string, value: string, nextStep: 1 | 2) {
    const next = applyAnswer({ ...profile, tier1: { ...profile.tier1, entryContext: 'seminar' } }, field, value);
    commit(next);
    track('answer', { mode: 'seminar', field, value });
    setStep(nextStep);
  }

  const firstStep = nextSteps(profile)[0]?.title ?? 'Create an emergency medical card';

  return (
    <div className="stage">
      <div className="seminar">
        <h2>SAM Readiness — Seminar</h2>
        <div className="sub">Agent-operated. Ask the question aloud, tap the answer, and print the card. Takes about a minute.</div>

        {step === 0 && (
          <>
            <div className="bigq">Agent, enter your name for the card:</div>
            <div className="freetext" style={{ margin: 0 }}>
              <input value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="e.g. Maria (MASA)" />
            </div>
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

        {step === 2 && (
          <>
            <div className="bigq">Ready — print the attendee's card.</div>
            <p style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 14 }}>
              Their suggested first step: <strong>{firstStep}</strong>. Hand them the printed card — it carries
              their <strong>resume code {code}</strong> and a QR that opens the app to finish the full file at home.
            </p>
            <button
              className="btn btn-horizon btn-lg btn-block"
              disabled={!qr}
              onClick={() => {
                printSeminarCard(agent || 'MASA agent', code, qr);
                track('seminar_card_printed', { code });
              }}
            >
              {qr ? '🖨 Print seminar card' : 'Preparing card…'}
            </button>
            <div className="seminar-guard">
              Guardrail: no medications, diagnoses, or cognitive/mobility details are shown here or asked aloud in
              the room. The front of the card is blank write-in lines the household fills in themselves.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
