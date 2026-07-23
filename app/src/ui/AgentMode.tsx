import { useMemo, useState } from 'react';
import { listCodes, setAttendeeName, type CodeRecord } from '../store/codeStore';
import type { Tier1 } from '../domain/profile';
import { scoreProfile } from '../domain/scoring';
import { emptyProfile } from '../domain/profile';

/**
 * Agent tablet view (demo surface, PRD §5.2 sales motion).
 *
 * On the agent's tablet during the tableside conversation: pull up a lead by the code
 * shown on their kiosk screen, see their non-medical 1st-half answers for a WARM INTRO,
 * tie the code to the attendee's name, and later see who came back and finished.
 *
 * Reads the simulated code store (store/codeStore.ts). In the real product this is a
 * backend lookup; here it's localStorage, so it lists whatever this browser has seen.
 */

const HOUSEHOLD: Record<string, string> = {
  solo: 'Just them',
  couple: 'Couple / partners',
  kids: 'Family with kids',
  multigen: 'Multi-generational',
  caregiver: 'Cares for an aging parent',
};
const ROLE: Record<string, string> = {
  caregiver_nearby: 'Nearby caregiver',
  caregiver_remote: 'Remote caregiver',
  patient: 'Patient',
};
const GEO: Record<string, string> = {
  disaster: 'Disaster-prone area',
  rural: 'Rural / far from a hospital',
  travel: 'Travels often / two homes',
  none: 'No location risk noted',
};
const WORRY: Record<string, string> = {
  info: 'No one would have the right info',
  chaos: 'Panic / getting separated',
  cost: 'Cost of transport',
  distance: 'Distance from care',
  not_sure: 'Not sure yet',
};
const INVENTORY: Record<string, string> = {
  meds_record: 'Meds/allergies list',
  contacts: 'Emergency contacts',
  decision_maker: 'Decision-maker',
  go_bag: 'Go-bag / med supply',
  written_plan: 'Written plan',
};

function scoreFor(tier1: Tier1) {
  // Score the snapshot as-is (1st-half only) for a quick agent-side read.
  const p = { ...emptyProfile('agent-view', '2026-01-01T00:00:00Z'), tier1 };
  return scoreProfile(p);
}

export function AgentMode() {
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(() => listCodes(), [tick]);
  const active = records.find((r) => r.code === selected) ?? null;

  function select(rec: CodeRecord) {
    setSelected(rec.code);
    setNameDraft(rec.attendeeName ?? '');
  }

  function saveName() {
    if (!active) return;
    setAttendeeName(active.code, nameDraft);
    setTick((n) => n + 1);
  }

  return (
    <div className="stage">
      <div className="agentview">
        <div className="agenthead">
          <h2>Agent tablet</h2>
          <p className="agentsub">
            Leads who started at the seminar. Pull one up by the code on their screen for a warm intro, add their name,
            and see who came back to finish.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => setTick((n) => n + 1)}>Refresh</button>
        </div>

        {records.length === 0 ? (
          <div className="agentempty">
            No seminar leads yet. Switch to <strong>seminar</strong> mode, answer the questions, and a code will appear
            here.
          </div>
        ) : (
          <div className="agentgrid">
            <div className="agentlist">
              {records.map((r) => (
                <button key={r.code} className={`agentrow ${selected === r.code ? 'on' : ''}`} onClick={() => select(r)}>
                  <span className="acode">{r.code}</span>
                  <span className="aname">{r.attendeeName || 'Unnamed lead'}</span>
                  <span className={`astatus ${r.status}`}>{r.status === 'completed' ? '✓ Completed' : 'Started'}</span>
                </button>
              ))}
            </div>

            <div className="agentdetail">
              {active ? (
                <>
                  <div className="adhead">
                    <div>
                      <div className="adcode">Code {active.code}</div>
                      <div className={`astatus ${active.status}`}>{active.status === 'completed' ? '✓ Completed their plan' : 'Started at seminar'}</div>
                    </div>
                    <div className="adscore">{scoreFor(active.tier1).band}</div>
                  </div>

                  <div className="adname">
                    <label htmlFor="attendee">Attendee name</label>
                    <div className="th-row">
                      <input id="attendee" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="e.g. Robert M." />
                      <button className="btn btn-primary" onClick={saveName}>Save</button>
                    </div>
                  </div>

                  <div className="section-h">Their answers (for your intro)</div>
                  <AnswerRows tier1={active.tier1} />
                </>
              ) : (
                <div className="agentempty">Select a lead to see their answers.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerRows({ tier1 }: { tier1: Tier1 }) {
  const inv = tier1.inventory.length ? tier1.inventory.map((i) => INVENTORY[i] ?? i).join(', ') : 'None in place yet';
  const rows: [string, string][] = [
    ['Household', tier1.householdType ? HOUSEHOLD[tier1.householdType] : '—'],
    ...(tier1.role ? ([['Caregiver role', ROLE[tier1.role] ?? tier1.role]] as [string, string][]) : []),
    ['Location', tier1.geoRisk ? GEO[tier1.geoRisk] : '—'],
    ['Already in place', inv],
    ['Most worried about', tier1.topWorry ? WORRY[tier1.topWorry] : '—'],
  ];
  return (
    <div className="answerrows">
      {rows.map(([k, v]) => (
        <div className="arow" key={k}>
          <span className="ak">{k}</span>
          <span className="av">{v}</span>
        </div>
      ))}
      <div className="adnote">Note: medications and advocacy questions are private — the lead answers those at home, not here.</div>
    </div>
  );
}
