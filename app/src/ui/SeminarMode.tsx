import { useEffect, useState } from 'react';
import type { Profile } from '../domain/profile';
import { householdReadinessFlow as flow } from '../content/flow';
import { scoreProfile } from '../domain/scoring';
import { nextSteps } from '../domain/steps';
import { SamBubble, Scorecard } from './common';
import { BigButtonStage } from './BigButtonStage';
import { printSeminarCard } from './print';
import { finishUrl, qrSvg, resumeCode, resumeUrl } from './resume';
import { saveCodeSnapshot } from '../store/codeStore';

/**
 * Seminar mode (PRD §5.2): on a shared tablet, agent-operated. The lead answers the
 * NON-MEDICAL 1st half of the flow (household → geo → inventory → worry, plus the
 * caregiver role) via BigButtonStage, which stops at `half_break`. The medical 2nd half
 * (advocacy, medications) is never shown here — it's completed at home (§5.2, §13).
 *
 * The lead's answers are saved under a short CODE (store/codeStore.ts) so the agent can
 * pull them up for a warm intro and the lead can resume with the code. Take-home model:
 * a simulated "Text me my link" plus the generic QR on the pre-printed card.
 */
const HOUSEHOLD_PHRASE: Record<string, string> = {
  solo: 'a one-person household',
  couple: 'a couple',
  kids: 'a family with kids',
  multigen: 'a multi-generational household',
};
const WORRY_PHRASE: Record<string, string> = {
  info: 'no one having the right information',
  chaos: 'panic or getting separated',
  cost: 'the cost of emergency transport',
  distance: 'being far from care',
  not_sure: 'what matters most',
};
const MOCK_PHONE = '(555) 012-3456';

export function SeminarMode({ profile, commit, track }: { profile: Profile; commit: (p: Profile) => void; track: (t: string, d?: Record<string, unknown>) => void }) {
  const [revealed, setRevealed] = useState<Profile | null>(null);
  const [qr, setQr] = useState<string>(''); // generic card QR, for the proto "view printed card" link
  const [phone, setPhone] = useState(MOCK_PHONE);
  const [sent, setSent] = useState(false);

  const code = resumeCode(profile);

  // On reaching the reveal, persist the 1st-half answers under the code so the agent
  // tablet can see them and the lead can resume at home.
  useEffect(() => {
    if (revealed) {
      qrSvg(finishUrl()).then(setQr);
      saveCodeSnapshot(code, revealed, 'seminar_started');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  if (!revealed) {
    return (
      <BigButtonStage
        profile={{ ...profile, tier1: { ...profile.tier1, entryContext: 'seminar' } }}
        commit={commit}
        track={track}
        startId={flow.startId}
        stopIds={['half_break']}
        onComplete={setRevealed}
        title="Household Readiness"
        sub="A few quick questions — about two minutes — then your personalized plan."
      />
    );
  }

  const score = scoreProfile(revealed);
  const steps = nextSteps(revealed);
  const household = HOUSEHOLD_PHRASE[revealed.tier1.householdType ?? 'solo'] ?? 'your household';
  const worry = WORRY_PHRASE[revealed.tier1.topWorry ?? 'info'] ?? 'what matters most';

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
            <p className="th-copy">We'll text you a link that opens your plan on your phone — already signed in, ready to finish the last two private questions in about five minutes.</p>
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
