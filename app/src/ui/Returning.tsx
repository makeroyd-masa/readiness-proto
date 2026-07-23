import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Profile } from '../domain/profile';
import { useDemoProfile } from './useDemoProfile';
import { BigButtonStage } from './BigButtonStage';
import { Result } from './Result';
import { SparkIcon } from './SparkIcon';
import { getCodeSnapshot, setCodeStatus } from '../store/codeStore';

/**
 * Finish-at-home surface (/returning). The lead comes back with the code from the
 * seminar and completes the private, MEDICAL 2nd half of their plan.
 *
 * Demo model: this is a mock of "coming back with your code." We don't rely on real
 * cross-device persistence — a fixed phase-1 PERSONA stands in for the answers the lead
 * gave at the seminar, so any code continues. (If the code IS in this browser's code
 * store, we still recognize it and mark it completed for the agent view.) Phase 2 uses
 * the same big-button style as the seminar kiosk.
 */

// The representative lead whose Tier-P (seminar) answers we assume — v3 fields.
const PERSONA = (base: Profile): Profile => ({
  ...base,
  tier1: {
    ...base.tier1,
    householdType: 'couple',
    agingParent: 'no',
    geoRisk: 'rural',
    role: null,
    contactsReadiness: 'documented', // has a written contact list
    decisionMaker: 'informal', // someone in mind, not made official → legal-paperwork Q applies
    topWorry: 'cost',
    inventory: ['meds_record'],
    entryContext: 'shared_link',
  },
});

type Stage = 'landing' | 'phase2' | 'building' | 'result';

export function Returning() {
  const [params] = useSearchParams();
  const urlCode = params.get('resume') ?? '';
  const { profile, commit, track } = useDemoProfile(PERSONA);

  const [stage, setStage] = useState<Stage>('landing');
  const [code, setCode] = useState(urlCode.toUpperCase());

  // SMS deep link (?resume=CODE) auto-continues; the generic card (?finish) shows the form.
  useEffect(() => {
    if (urlCode) start(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(enteredCode: string) {
    const c = enteredCode.trim().toUpperCase();
    commit({ ...profile, activeCode: c || null });
    track('resume_from_card', { code: c, found: Boolean(getCodeSnapshot(c)) });
    setStage('phase2');
  }

  function onPhase2Done(final: Profile) {
    commit(final);
    if (final.activeCode) setCodeStatus(final.activeCode, 'completed');
    track('intake_complete', { via: 'returning' });
    setStage('building');
  }

  if (stage === 'phase2') {
    return (
      <BigButtonStage
        profile={profile}
        commit={commit}
        track={track}
        startId="q_authority"
        stopIds={['reveal']}
        onComplete={onPhase2Done}
        title="Finish your plan"
        sub="A few private questions — legal, medical, and financial — just for your household's file."
      />
    );
  }

  if (stage === 'building') {
    return <Building onDone={() => setStage('result')} />;
  }

  if (stage === 'result') {
    return (
      <div className="sam-ui">
        <div className="stage">
          <Result profile={profile} commit={commit} track={track} />
        </div>
      </div>
    );
  }

  // landing
  const found = code.trim().length > 0 ? Boolean(getCodeSnapshot(code.trim())) : false;
  return (
    <div className="sam-ui">
      <div className="stage">
        <div className="resume-hero">
          <div className="sam-badge">
            <SparkIcon size={22} />
          </div>
          <h1>Finish your plan at home</h1>
          <p>
            You started your Family Readiness File at the seminar. Enter your follow-up ID to pick up where you left
            off — about five minutes to finish the two private questions and get your full plan.
          </p>
        </div>

        <div className="resume-entry">
          <label htmlFor="followup">Your follow-up ID</label>
          <div className="resume-hint">It's the code your MASA agent wrote on your card.</div>
          <input
            id="followup"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 4F9A2C7B"
            autoCapitalize="characters"
            autoComplete="off"
          />
          {code.trim().length > 0 &&
            (found ? (
              <div className="resume-ok">✓ Found your seminar answers — we'll pick up where you left off.</div>
            ) : (
              <div className="resume-warn">We'll continue with your saved plan.</div>
            ))}
        </div>

        <button className="btn btn-primary btn-block" disabled={code.trim().length === 0} onClick={() => start(code)}>
          Continue my plan →
        </button>
        <div className="footdisc">
          Helping a parent? You can finish their plan with them from here too. SAM offers guidance, not medical advice.
          In an emergency, always call 911.
        </div>
      </div>
    </div>
  );
}

function Building({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sam-ui">
      <div className="stage">
        <div className="building">
          <div className="sam-badge" style={{ margin: '0 auto 16px' }}>
            <SparkIcon size={24} />
          </div>
          <h2>Finishing your plan…</h2>
          <div className="dots">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
}
