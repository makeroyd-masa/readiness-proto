import { useEffect, useState } from 'react';
import type { Profile } from '../domain/profile';
import type { FlowNode, QuestionNode } from '../domain/nodes';
import { householdReadinessFlow as flow } from '../content/flow';
import { applyAnswer, firstNode, nextNode } from '../engine/engine';
import { scoreProfile } from '../domain/scoring';
import { nextSteps } from '../domain/steps';
import { SamBubble, Scorecard } from './common';
import { printSeminarCard } from './print';
import { finishUrl, qrSvg, resumeCode, resumeUrl } from './resume';
import { saveCodeSnapshot } from '../store/codeStore';

/**
 * Seminar mode (PRD §5.2): on a shared tablet, agent-operated. The lead answers the
 * NON-MEDICAL 1st half of the flow (household → geo → inventory → worry, plus the
 * caregiver role) and lands on the real customer payoff — a personalized readiness
 * reveal — with a "take it home" path.
 *
 * The questions are walked straight from content/flow.ts and STOP at `half_break`;
 * the medical 2nd half (advocacy, medications) is never shown on the shared screen and
 * is completed at home (§5.2, §13). The lead's answers are saved under a short CODE
 * (see store/codeStore.ts) so the agent can pull them up for a warm intro and the lead
 * can resume with the code.
 *
 * Take-home model: an on-screen simulated "Text me my link" (the SMS link has the
 * follow-up ID appended → auto-login), plus the generic QR on the pre-printed card
 * (the agent hand-writes the follow-up ID; the lead enters it after scanning).
 */
const HOUSEHOLD_PHRASE: Record<string, string> = {
  solo: 'a one-person household',
  couple: 'a couple',
  caregiver: 'caring for an aging parent',
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

const asText = (say: string | ((p: Profile) => string), p: Profile) => (typeof say === 'function' ? say(p) : say);

/** Resolve forward to the next big-button question, skipping the welcome intro and
 *  the travel seam. Returns null once the non-medical half ends at `half_break`. */
function skipToQuestion(node: FlowNode | null, p: Profile): FlowNode | null {
  let n = node;
  while (n && (n.type === 'seam' || (n.type === 'content' && n.id === 'welcome'))) {
    n = nextNode(flow, n, p);
  }
  // `half_break` (content) marks the end of the shared-screen half → no more questions.
  if (n && n.type === 'content' && n.id === 'half_break') return null;
  return n;
}

export function SeminarMode({ profile, commit, track }: { profile: Profile; commit: (p: Profile) => void; track: (t: string, d?: Record<string, unknown>) => void }) {
  const [current, setCurrent] = useState<QuestionNode | null>(() => skipToQuestion(firstNode(flow, profile), profile) as QuestionNode | null);
  const [reveal, setReveal] = useState(false);
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
  const [qr, setQr] = useState<string>(''); // generic card QR, for the proto "view printed card" link
  const [phone, setPhone] = useState(MOCK_PHONE);
  const [sent, setSent] = useState(false);

  const code = resumeCode(profile);

  // On reaching the reveal, persist the 1st-half answers under the code so the agent
  // tablet can see them and the lead can resume at home.
  useEffect(() => {
    if (reveal) {
      qrSvg(finishUrl()).then(setQr);
      saveCodeSnapshot(code, profile, 'seminar_started');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  function advance(from: QuestionNode, next: Profile) {
    const n = skipToQuestion(nextNode(flow, from, next), next);
    setMultiSel(new Set());
    if (n && n.type === 'question') {
      setCurrent(n as QuestionNode);
    } else {
      setCurrent(null);
      setReveal(true);
    }
  }

  function answerSingle(q: QuestionNode, value: string) {
    const next = applyAnswer({ ...profile, tier1: { ...profile.tier1, entryContext: 'seminar' } }, q.field, value);
    commit(next);
    track('answer', { mode: 'seminar', node: q.id, field: q.field, value });
    advance(q, next);
  }

  function commitMulti(q: QuestionNode) {
    const values = Array.from(multiSel);
    const next = applyAnswer({ ...profile, tier1: { ...profile.tier1, entryContext: 'seminar' } }, q.field, values);
    commit(next);
    track('answer', { mode: 'seminar', node: q.id, field: q.field, value: values });
    advance(q, next);
  }

  function toggleMulti(q: QuestionNode, value: string, exclusive?: boolean) {
    setMultiSel((prev) => {
      const s = new Set(prev);
      if (exclusive) return s.has(value) ? new Set() : new Set([value]);
      q.options.filter((o) => o.exclusive).forEach((o) => s.delete(o.value));
      s.has(value) ? s.delete(value) : s.add(value);
      return s;
    });
  }

  if (reveal) {
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

  return (
    <div className="stage">
      <div className="seminar">
        <h2>Household Readiness</h2>
        <div className="sub">A few quick questions — about two minutes — then your personalized plan.</div>

        {current && (
          <>
            <div className="bigq">{asText(current.say, profile)}</div>
            <div className="bigopts">
              {current.options.map((o) => {
                const sel = multiSel.has(o.value);
                return (
                  <button
                    key={o.value}
                    className={`btn btn-lg btn-block ${current.multi ? (sel ? 'btn-primary sel' : 'btn-ghost') : 'btn-primary'}`}
                    onClick={() => (current.multi ? toggleMulti(current, o.value, o.exclusive) : answerSingle(current, o.value))}
                  >
                    {current.multi && sel ? '✓ ' : ''}
                    {o.label}
                  </button>
                );
              })}
            </div>
            {current.multi && (
              <button className="btn btn-horizon btn-block" style={{ marginTop: 12 }} disabled={multiSel.size === 0} onClick={() => commitMulti(current)}>
                Continue →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
