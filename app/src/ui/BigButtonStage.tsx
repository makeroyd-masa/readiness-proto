import { useState } from 'react';
import type { Profile } from '../domain/profile';
import type { QuestionNode } from '../domain/nodes';
import { householdReadinessFlow as flow } from '../content/flow';
import { applyAnswer, resolve } from '../engine/engine';

/**
 * A big-button, one-question-at-a-time walker over the authored flow — the kiosk /
 * finish-at-home UI. Shared by the seminar (1st, non-medical half) and the returning
 * page (2nd, medical half). It walks from `startId`, renders each question the engine
 * yields (single- or multi-select), skips content/seam nodes, and calls `onComplete`
 * with the final profile when it reaches any id in `stopIds` (or the end of the flow).
 */
interface Props {
  profile: Profile;
  commit: (p: Profile) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  startId: string;
  stopIds: string[];
  onComplete: (final: Profile) => void;
  title: string;
  sub: string;
}

const asText = (say: string | ((p: Profile) => string), p: Profile) => (typeof say === 'function' ? say(p) : say);

export function BigButtonStage({ profile, commit, track, startId, stopIds, onComplete, title, sub }: Props) {
  // Resolve forward from `fromId` to the next question, skipping content/seam nodes.
  // Returns null once a stop boundary (or the end of the flow) is reached.
  function toNextQuestion(fromId: string | undefined, p: Profile): QuestionNode | null {
    let node = resolve(flow, fromId, p);
    while (node) {
      if (stopIds.includes(node.id)) return null;
      if (node.type === 'question') return node as QuestionNode;
      node = resolve(flow, (node as { next?: string }).next, p);
    }
    return null;
  }

  const [current, setCurrent] = useState<QuestionNode | null>(() => toNextQuestion(startId, profile));
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());

  function advance(from: QuestionNode, next: Profile) {
    const q = toNextQuestion((from as { next?: string }).next, next);
    setMultiSel(new Set());
    if (q) {
      setCurrent(q);
    } else {
      setCurrent(null);
      onComplete(next);
    }
  }

  function answerSingle(q: QuestionNode, value: string) {
    const next = applyAnswer({ ...profile, tier1: { ...profile.tier1, entryContext: profile.tier1.entryContext } }, q.field, value);
    commit(next);
    track('answer', { stage: 'bigbutton', node: q.id, field: q.field, value });
    advance(q, next);
  }

  function commitMulti(q: QuestionNode) {
    const values = Array.from(multiSel);
    const next = applyAnswer(profile, q.field, values);
    commit(next);
    track('answer', { stage: 'bigbutton', node: q.id, field: q.field, value: values });
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

  return (
    <div className="stage">
      <div className="seminar">
        <h2>{title}</h2>
        <div className="sub">{sub}</div>

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
