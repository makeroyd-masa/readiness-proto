import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../domain/profile';
import type { FlowNode, QuestionNode } from '../domain/nodes';
import { householdReadinessFlow as flow } from '../content/flow';
import { applyAnswer, firstNode, nextNode } from '../engine/engine';
import { Mark, SamBubble, UserBubble } from './common';
import { Result } from './Result';

type Phase = 'intro' | 'flow' | 'building' | 'result';
type Line = { kind: 'sam' | 'user'; text: string };

interface Props {
  profile: Profile;
  commit: (next: Profile) => void;
  track: (type: string, detail?: Record<string, unknown>) => void;
  /** start straight in the flow (used when resuming a partial intake). */
  autostart?: boolean;
}

const asText = (say: string | ((p: Profile) => string), p: Profile) => (typeof say === 'function' ? say(p) : say);

export function StandardMode({ profile, commit, track, autostart }: Props) {
  const [phase, setPhase] = useState<Phase>(autostart ? 'flow' : 'intro');
  const [lines, setLines] = useState<Line[]>([]);
  const [active, setActive] = useState<QuestionNode | null>(null);
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
  const stageRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (phase === 'flow' && !started.current) {
      started.current = true;
      driveFrom(firstNode(flow, profile), profile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: stageRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, active, phase]);

  /** Walk auto/content nodes, appending SAM copy, until a question or the reveal. */
  function driveFrom(node: FlowNode | null, p: Profile) {
    let cur = node;
    const newLines: Line[] = [];
    for (let i = 0; i < 50 && cur; i++) {
      if (cur.type === 'content') {
        if (cur.id === 'reveal') {
          if (newLines.length) setLines((l) => [...l, ...newLines]);
          finishIntake();
          return;
        }
        newLines.push({ kind: 'sam', text: asText(cur.say, p) });
        cur = nextNode(flow, cur, p);
        continue;
      }
      if (cur.type === 'seam' && cur.seam === 'cross_flow') {
        newLines.push({ kind: 'sam', text: "Since you're often on the move, I'll line up a Travel Readiness track for you too — that one's coming soon." });
        cur = nextNode(flow, cur, p);
        continue;
      }
      if (cur.type === 'question') {
        newLines.push({ kind: 'sam', text: asText(cur.say, p) });
        setLines((l) => [...l, ...newLines]);
        setActive(cur);
        setMultiSel(new Set());
        return;
      }
      cur = nextNode(flow, cur, p);
    }
    if (newLines.length) setLines((l) => [...l, ...newLines]);
  }

  function answerSingle(q: QuestionNode, value: string, label: string) {
    const next = applyAnswer(profile, q.field, value);
    commit(next);
    track('answer', { node: q.id, field: q.field, value });
    setLines((l) => [...l, { kind: 'user', text: label }]);
    setActive(null);
    driveFrom(nextNode(flow, q, next), next);
  }

  function commitMulti(q: QuestionNode) {
    const values = Array.from(multiSel);
    const next = applyAnswer(profile, q.field, values);
    commit(next);
    track('answer', { node: q.id, field: q.field, value: values });
    const label = values.length === 0 || values.includes('none') ? 'None of these yet' : `${values.filter((v) => v !== 'none').length} in place`;
    setLines((l) => [...l, { kind: 'user', text: label }]);
    setActive(null);
    driveFrom(nextNode(flow, q, next), next);
  }

  function toggleMulti(q: QuestionNode, value: string, exclusive?: boolean) {
    setMultiSel((prev) => {
      const s = new Set(prev);
      if (exclusive) return s.has(value) ? new Set() : new Set([value]);
      // selecting a normal option clears any exclusive option
      const exclusiveVals = q.options.filter((o) => o.exclusive).map((o) => o.value);
      exclusiveVals.forEach((v) => s.delete(v));
      s.has(value) ? s.delete(value) : s.add(value);
      return s;
    });
  }

  function finishIntake() {
    setPhase('building');
    track('intake_complete');
  }

  if (phase === 'intro') {
    return (
      <div className="stage" ref={stageRef}>
        <div className="intro">
          <div className="avatar" style={{ width: 46, height: 46, margin: '6px auto 16px' }}>
            <Mark size={26} />
          </div>
          <h1>Would your household know what to do in a medical emergency?</h1>
          <p>
            Most families assume they're ready. Then the moment comes and no one can find a medication list, a
            phone number, or who's allowed to make decisions.
          </p>
          <div className="previewmeter">
            <div className="t">In 5 minutes, SAM builds you:</div>
            <div className="pill-row">
              <span className="pill">A readiness score</span>
              <span className="pill">Your top 3 next steps</span>
              <span className="pill">An emergency info file</span>
              <span className="pill">A plan you can share</span>
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => setPhase('flow')}>
            Start my readiness check →
          </button>
          <div className="disc">SAM offers guidance, not medical advice. In an emergency, always call 911.</div>
        </div>
      </div>
    );
  }

  if (phase === 'building') {
    return <Building profile={profile} onDone={() => setPhase('result')} />;
  }

  return (
    <div className="stage" ref={stageRef}>
      {phase === 'result' ? (
        <Result profile={profile} commit={commit} track={track} />
      ) : (
        <>
          {lines.map((l, i) => (l.kind === 'sam' ? <SamBubble key={i}>{l.text}</SamBubble> : <UserBubble key={i} text={l.text} />))}
          {active && (
            <QuestionOptions
              key={active.id}
              q={active}
              multiSel={multiSel}
              onSingle={answerSingle}
              onToggle={toggleMulti}
              onContinue={() => commitMulti(active)}
            />
          )}
        </>
      )}
    </div>
  );
}

function QuestionOptions({
  q,
  multiSel,
  onSingle,
  onToggle,
  onContinue,
}: {
  q: QuestionNode;
  multiSel: Set<string>;
  onSingle: (q: QuestionNode, value: string, label: string) => void;
  onToggle: (q: QuestionNode, value: string, exclusive?: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="opts">
        {q.options.map((o) => {
          const sel = multiSel.has(o.value);
          return (
            <button
              key={o.value}
              className={`opt ${sel ? 'sel' : ''}`}
              onClick={() => (q.multi ? onToggle(q, o.value, o.exclusive) : onSingle(q, o.value, o.label))}
            >
              {q.multi && sel ? <span className="ck">✓ </span> : null}
              {o.label}
            </button>
          );
        })}
      </div>
      {q.multi && (
        <>
          <div className="multinote">Select all that apply, then continue.</div>
          <div className="cont">
            <button className="btn btn-horizon" disabled={multiSel.size === 0} onClick={onContinue}>
              Continue →
            </button>
          </div>
        </>
      )}
    </>
  );
}

const WHO: Record<string, string> = {
  solo: 'you',
  couple: 'you and your partner',
  kids: 'your family',
  multigen: 'your multi-generational household',
  caregiver: 'you and your parent',
};

function Building({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const linesRef = useRef<string[]>([]);

  if (linesRef.current.length === 0) {
    const L: string[] = [];
    L.push(`Reading your household: ${WHO[profile.tier1.householdType ?? 'solo']}…`);
    if (profile.tier1.vulnerability && profile.tier1.vulnerability !== 'none') L.push('Flagging that someone may not be able to speak for themselves…');
    if (profile.tier1.geoRisk === 'disaster') L.push('Adding evacuation and medication-supply steps for your area…');
    if (profile.tier1.role === 'caregiver_remote') L.push('Prioritizing remote-coordination steps…');
    L.push('Choosing the 3 steps that matter most for you…');
    linesRef.current = L;
  }
  const lines = linesRef.current;

  useEffect(() => {
    const timers: number[] = [];
    lines.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), 350 + i * 680)));
    timers.push(window.setTimeout(onDone, 350 + lines.length * 680 + 600));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="stage">
      <div className="building">
        <div className="avatar">
          <Mark size={28} />
        </div>
        <h2>Building your readiness plan…</h2>
        <div>
          {lines.map((t, i) => (
            <div key={i} className={`buildline ${i < shown ? 'on' : ''}`}>
              {t}
            </div>
          ))}
        </div>
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
