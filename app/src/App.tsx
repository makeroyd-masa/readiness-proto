import { useMemo, useState } from 'react';
import './ui/theme.css';
import type { Profile } from './domain/profile';
import { hasIntake } from './domain/profile';
import type { MemberStatus, Mode } from './domain/valueSets';
import { scoreProfile } from './domain/scoring';
import { loadProfile, logEvent, resetProfile, saveProfile } from './store/profileStore';
import { assertFlowIntegrity } from './engine/guards';
import { householdReadinessFlow } from './content/flow';
import { Mark, ReadinessMeter } from './ui/common';
import { StandardMode } from './ui/StandardMode';
import { SeminarMode } from './ui/SeminarMode';
import { ReturningMode } from './ui/ReturningMode';
import { ResumeMode } from './ui/ResumeMode';
import { Result } from './ui/Result';

/** Resume code from a scanned seminar-card QR (?resume=CODE), read once at load. */
const initialResumeCode = new URLSearchParams(window.location.search).get('resume');

// Dev-time integrity check — makes the v1 dead-branch class of bug fail loudly (§18).
if (import.meta.env.DEV) assertFlowIntegrity(householdReadinessFlow);

type ReturningView = 'menu' | 'review' | 'flow';

export default function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [mode, setMode] = useState<Mode>(() => (hasIntake(loadProfile()) ? 'returning' : 'standard'));
  const [returningView, setReturningView] = useState<ReturningView>('menu');
  const [instance, setInstance] = useState(0); // bump to remount a mode
  const [resumeCode, setResumeCode] = useState<string | null>(initialResumeCode);
  const [standardAutostart, setStandardAutostart] = useState(false);

  const commit = (next: Profile) => setProfile(saveProfile(next));
  const track = (type: string, detail?: Record<string, unknown>) => setProfile(logEvent(profile, type, detail));

  const score = useMemo(() => scoreProfile(profile), [profile]);
  const showSpine = mode !== 'seminar' && hasIntake(profile);
  const spineHint = profile.checkinSet
    ? 'Check-in on: SAM will refresh this every 6 months.'
    : score.displayPct < 92
      ? "There's always a next step — SAM will nudge you."
      : 'SAM keeps this updated as things change.';

  function setMemberStatus(ms: MemberStatus) {
    commit({ ...profile, tier1: { ...profile.tier1, memberStatus: ms } });
  }

  function hardResetAll() {
    setProfile(resetProfile());
    setMode('standard');
    setReturningView('menu');
    setStandardAutostart(false);
    setInstance((n) => n + 1);
  }

  function switchMode(m: Mode) {
    setMode(m);
    setReturningView('menu');
    setResumeCode(null);
    setStandardAutostart(false);
    setInstance((n) => n + 1);
  }

  // Scanned the seminar card's QR → continue into the full flow at home (PRD §5.2).
  function continueFromResume() {
    const next = { ...profile, tier1: { ...profile.tier1, entryContext: 'shared_link' as const } };
    commit(logEvent(next, 'resume_from_card', { code: resumeCode }));
    setMode('standard');
    setReturningView('menu');
    setResumeCode(null);
    setStandardAutostart(true);
    setInstance((n) => n + 1);
    window.history.replaceState({}, '', window.location.pathname); // drop ?resume so refresh won't relaunch
  }

  return (
    <div className="device">
      <div className="intbanner">INTERNAL PROTOTYPE · synthetic data · content licensing not cleared · not for distribution</div>

      <div className="topbar">
        <span className="mark">
          <Mark />
        </span>
        <div className="brandwrap">
          <span className="sam">Ask SAM</span>
          <span className="by">from MASA</span>
        </div>
        <span className="tag">READINESS CHECK</span>
      </div>

      {/* Dev/demo controls (not part of the product surface) */}
      <div className="devbar no-print">
        <span className="dl">Mode</span>
        {(['standard', 'seminar', 'returning'] as Mode[]).map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => switchMode(m)}>
            {m}
          </button>
        ))}
        <span className="spacer" />
        <span className="dl">You are</span>
        {(['prospect', 'member', 'unknown'] as MemberStatus[]).map((ms) => (
          <button key={ms} className={profile.tier1.memberStatus === ms ? 'on' : ''} onClick={() => setMemberStatus(ms)}>
            {ms}
          </button>
        ))}
        <button onClick={hardResetAll} title="Clear the persisted profile">
          reset
        </button>
      </div>

      {resumeCode ? (
        <ResumeMode code={resumeCode} onContinue={continueFromResume} />
      ) : (
        <>
          {showSpine && <ReadinessMeter score={score} hint={spineHint} />}

          {mode === 'standard' && (
            <StandardMode key={`std-${instance}`} profile={profile} commit={commit} track={track} autostart={standardAutostart} />
          )}

          {mode === 'seminar' && <SeminarMode key={`sem-${instance}`} profile={profile} commit={commit} track={track} />}

          {mode === 'returning' &&
            (returningView === 'review' ? (
              <div className="stage">
                <Result profile={profile} commit={commit} track={track} />
              </div>
            ) : returningView === 'flow' ? (
              <StandardMode key={`ret-${instance}`} profile={profile} commit={commit} track={track} autostart />
            ) : (
              <ReturningMode profile={profile} onReview={() => setReturningView('review')} onUpdate={() => setReturningView('flow')} />
            ))}
        </>
      )}
    </div>
  );
}
