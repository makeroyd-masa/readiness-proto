import { useMemo, useState } from 'react';
import './ui/theme.css';
import type { Profile } from './domain/profile';
import { hasIntake } from './domain/profile';
import type { MemberStatus, Mode } from './domain/valueSets';
import { scoreProfile } from './domain/scoring';
import { loadProfile, logEvent, resetProfile, saveProfile } from './store/profileStore';
import { getCodeSnapshot } from './store/codeStore';
import { assertFlowIntegrity } from './engine/guards';
import { householdReadinessFlow } from './content/flow';
import { ReadinessMeter } from './ui/common';
import { StandardMode } from './ui/StandardMode';
import { SeminarMode } from './ui/SeminarMode';
import { ReturningMode } from './ui/ReturningMode';
import { ResumeMode } from './ui/ResumeMode';
import { AgentMode } from './ui/AgentMode';
import { Result } from './ui/Result';

// Read the seminar-loop entry params once at load:
//  ?resume=CODE → SMS deep link, auto-login.   ?finish → generic card QR, enter-ID.
const _params = new URLSearchParams(window.location.search);
const initialResumeCode = _params.get('resume');
const initialFinish = _params.get('finish') != null;

// Dev-time integrity check — makes the v1 dead-branch class of bug fail loudly (§18).
if (import.meta.env.DEV) assertFlowIntegrity(householdReadinessFlow);

type ReturningView = 'menu' | 'review' | 'flow';

export default function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [mode, setMode] = useState<Mode>(() => (hasIntake(loadProfile()) ? 'returning' : 'standard'));
  const [returningView, setReturningView] = useState<ReturningView>('menu');
  const [instance, setInstance] = useState(0); // bump to remount a mode
  const [resumeCode, setResumeCode] = useState<string | null>(initialResumeCode);
  const [finishEntry, setFinishEntry] = useState(initialFinish);
  const [standardAutostart, setStandardAutostart] = useState(false);
  const [startAtId, setStartAtId] = useState<string | undefined>(undefined);

  const commit = (next: Profile) => setProfile(saveProfile(next));
  const track = (type: string, detail?: Record<string, unknown>) => setProfile(logEvent(profile, type, detail));

  const score = useMemo(() => scoreProfile(profile), [profile]);
  const showSpine = mode !== 'seminar' && mode !== 'agent' && hasIntake(profile);
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
    setResumeCode(null);
    setFinishEntry(false);
    setStandardAutostart(false);
    setStartAtId(undefined);
    setInstance((n) => n + 1);
  }

  function switchMode(m: Mode) {
    setMode(m);
    setReturningView('menu');
    setResumeCode(null);
    setFinishEntry(false);
    setStandardAutostart(false);
    setStartAtId(undefined);
    setInstance((n) => n + 1);
  }

  // Came in via the SMS link (auto-login) or the card's generic QR (entered ID).
  // The code carries the seminar 1st-half answers (store/codeStore.ts): restore them
  // and resume at the MEDICAL 2nd half. If the code isn't found (e.g. a fresh device
  // with no local record), fall back to the full flow from the top (PRD §5.2).
  function continueFromResume(code: string) {
    const rec = getCodeSnapshot(code);
    const restoredTier1 = rec
      ? { ...rec.tier1, entryContext: 'shared_link' as const }
      : { ...profile.tier1, entryContext: 'shared_link' as const };
    const next: Profile = { ...profile, tier1: restoredTier1, activeCode: rec ? rec.code : null };
    commit(logEvent(next, 'resume_from_card', { code, found: Boolean(rec) }));
    setMode('standard');
    setReturningView('menu');
    setResumeCode(null);
    setFinishEntry(false);
    setStandardAutostart(true);
    setStartAtId(rec ? 'q_vulnerability' : undefined); // resume at the medical half when we have the 1st
    setInstance((n) => n + 1);
    window.history.replaceState({}, '', window.location.pathname); // drop ?resume/?finish so refresh won't relaunch
  }

  return (
    <div className="device">
      <div className="topbar">
        <img className="mark" src={`${import.meta.env.BASE_URL}masa-icon.jpg`} alt="MASA" />
        <div className="brandwrap">
          <span className="sam">AccessNow</span>
          <span className="by">by MASA</span>
        </div>
        <span className="tag">READINESS CHECK</span>
      </div>

      {/* Dev/demo controls (not part of the product surface) */}
      <div className="devbar no-print">
        <span className="dl">Mode</span>
        {(['standard', 'seminar', 'returning', 'agent'] as Mode[]).map((m) => (
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
        <ResumeMode variant="autologin" code={resumeCode} onContinue={continueFromResume} />
      ) : finishEntry ? (
        <ResumeMode variant="enterId" onContinue={continueFromResume} />
      ) : (
        <>
          {showSpine && <ReadinessMeter score={score} hint={spineHint} />}

          {mode === 'standard' && (
            <StandardMode key={`std-${instance}`} profile={profile} commit={commit} track={track} autostart={standardAutostart} startAtId={startAtId} />
          )}

          {mode === 'seminar' && <SeminarMode key={`sem-${instance}`} profile={profile} commit={commit} track={track} />}

          {mode === 'agent' && <AgentMode key={`agt-${instance}`} />}

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
