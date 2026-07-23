import { useState } from 'react';
import type { EmergencyContact, Profile } from '../domain/profile';
import type { InventoryItem } from '../domain/valueSets';
import { scoreProfile } from '../domain/scoring';
import { nextSteps } from '../domain/steps';
import { getEvidence } from '../content/evidence';
import { printHouseholdPlan } from './print';

/**
 * The three actionable summary tools (docs/Updated experience.txt "Follow-on"):
 *  1. People & roles — add emergency contacts + name a medical decision-maker.
 *  2. Go-bag + med supply — a checklist you tick off.
 *  3. Holistic household plan — assemble everything into a printable plan.
 *
 * Each writes real data AND sets the matching inventory flag so scoring
 * (domain/scoring.ts) — the single source of truth — reflects the progress.
 */

interface ToolProps {
  profile: Profile;
  commit: (p: Profile) => void;
  track: (t: string, d?: Record<string, unknown>) => void;
  onClose: () => void;
}

function withInventory(p: Profile, ...items: InventoryItem[]): InventoryItem[] {
  return Array.from(new Set([...p.tier1.inventory, ...items]));
}

/* ---------------------------------------------------------------- People & roles */

const BLANK_CONTACT: EmergencyContact = { name: '', relationship: '', phone: '' };

export function PeopleRolesTool({ profile, commit, track, onClose }: ToolProps) {
  const [rows, setRows] = useState<EmergencyContact[]>(
    profile.tier2.contacts.length ? profile.tier2.contacts : [{ ...BLANK_CONTACT }],
  );
  const [decisionMaker, setDecisionMaker] = useState<string>(profile.tier2.decisionMakerName ?? '');
  const [notSure, setNotSure] = useState<boolean>(profile.tier2.decisionMakerStatus === 'not_sure');

  const named = rows.map((r) => r.name.trim()).filter(Boolean);

  function update(i: number, field: keyof EmergencyContact, value: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { ...BLANK_CONTACT }]);
  }
  function removeRow(i: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));
  }

  function save() {
    const clean = rows.filter((r) => r.name.trim());
    const primary = clean[0];
    const dm = notSure ? '' : decisionMaker;
    const next: Profile = {
      ...profile,
      tier1: { ...profile.tier1, inventory: withInventory(profile, ...(clean.length ? (['contacts'] as InventoryItem[]) : []), ...(dm ? (['decision_maker'] as InventoryItem[]) : [])) },
      tier2: {
        ...profile.tier2,
        contacts: clean,
        emergencyContact: primary ? `${primary.name}${primary.relationship ? ` (${primary.relationship})` : ''}${primary.phone ? ` ${primary.phone}` : ''}` : profile.tier2.emergencyContact,
        decisionMakerName: dm || null,
        decisionMakerStatus: dm ? 'yes' : notSure ? 'not_sure' : profile.tier2.decisionMakerStatus,
      },
    };
    commit(next);
    track('tool_saved', { tool: 'people_roles', contacts: clean.length, decisionMaker: Boolean(dm) });
    onClose();
  }

  return (
    <ToolShell title="People & roles" onClose={onClose}>
      <p className="tool-intro">Add the people who should be reached in an emergency, and choose who can make medical decisions if someone can't speak for themselves.</p>

      <div className="section-h">Emergency contacts</div>
      {rows.map((r, i) => (
        <div className="contactrow" key={i}>
          <input placeholder="Name" value={r.name} onChange={(e) => update(i, 'name', e.target.value)} />
          <input placeholder="Relationship" value={r.relationship} onChange={(e) => update(i, 'relationship', e.target.value)} />
          <input placeholder="Phone" inputMode="tel" value={r.phone} onChange={(e) => update(i, 'phone', e.target.value)} />
          <button className="rowx" aria-label="Remove" onClick={() => removeRow(i)}>×</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={addRow}>+ Add another contact</button>

      <div className="section-h">Who can make medical decisions?</div>
      <div className="dmopts">
        {named.map((n) => (
          <label key={n} className={`dmopt ${!notSure && decisionMaker === n ? 'on' : ''}`}>
            <input type="radio" name="dm" checked={!notSure && decisionMaker === n} onChange={() => { setDecisionMaker(n); setNotSure(false); }} />
            {n}
          </label>
        ))}
        <label className={`dmopt ${notSure ? 'on' : ''}`}>
          <input type="radio" name="dm" checked={notSure} onChange={() => { setNotSure(true); setDecisionMaker(''); }} />
          I'm not sure yet
        </label>
      </div>
      {named.length === 0 && <div className="tool-hint">Add a contact above to choose them as your decision-maker.</div>}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save to my file</button>
      </div>
    </ToolShell>
  );
}

/* ------------------------------------------------------------------------ Go-bag */

const GO_BAG_ITEMS: { id: string; label: string }[] = [
  { id: 'meds', label: 'Several days of all daily medications' },
  { id: 'water', label: 'Water — one gallon per person per day (3 days)' },
  { id: 'docs', label: 'Copies of IDs, insurance cards, and a medication list' },
  { id: 'contact_card', label: 'Printed emergency contact card' },
  { id: 'charger', label: 'Phone charger / backup battery' },
  { id: 'first_aid', label: 'First-aid kit and any medical supplies' },
  { id: 'cash', label: 'Some cash in small bills' },
];
const GO_BAG_THRESHOLD = 5; // enough checked to count the go-bag as "in place"

export function GoBagTool({ profile, commit, track, onClose }: ToolProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set(profile.goBagItems));
  const ev = getEvidence('ready_kit');

  function toggle(id: string) {
    setChecked((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function save() {
    const items = Array.from(checked);
    const next: Profile = {
      ...profile,
      goBagItems: items,
      tier1: { ...profile.tier1, inventory: items.length >= GO_BAG_THRESHOLD ? withInventory(profile, 'go_bag') : profile.tier1.inventory },
    };
    commit(next);
    track('tool_saved', { tool: 'go_bag', checked: items.length });
    onClose();
  }

  return (
    <ToolShell title="Go-bag + medication supply" onClose={onClose}>
      <p className="tool-intro">Tick what you already have ready to grab. Check at least {GO_BAG_THRESHOLD} to count your go-bag as in place.</p>
      <div className="checklist">
        {GO_BAG_ITEMS.map((it) => (
          <label key={it.id} className={`checkitem ${checked.has(it.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={checked.has(it.id)} onChange={() => toggle(it.id)} />
            <span>{it.label}</span>
          </label>
        ))}
      </div>
      <div className="tool-progress">{checked.size} of {GO_BAG_ITEMS.length} ready{checked.size >= GO_BAG_THRESHOLD ? ' — go-bag counts as in place ✓' : ''}</div>
      {ev && (
        <a className="evidence" href={ev.sourceUrl} target="_blank" rel="noreferrer" title={ev.attribution}>
          {ev.publisher}: {ev.title}
        </a>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save my checklist</button>
      </div>
    </ToolShell>
  );
}

/* --------------------------------------------------------------- Holistic plan */

export function HouseholdPlanTool({ profile, commit, track, onClose }: ToolProps) {
  const steps = nextSteps(profile);
  const t2 = profile.tier2;

  function generate() {
    const next: Profile = {
      ...profile,
      tier1: { ...profile.tier1, inventory: withInventory(profile, 'written_plan') },
      artifactsBuilt: Array.from(new Set([...profile.artifactsBuilt, 'living_file'])),
    };
    commit(next);
    printHouseholdPlan(next, scoreProfile(next), nextSteps(next));
    track('artifact_delivered', { form: 'household_plan' });
    onClose();
  }

  const has = (v: string | null | undefined) => Boolean(v);
  const bullets: [string, boolean][] = [
    ['Readiness score by area', true],
    ['Emergency contacts', t2.contacts.length > 0],
    ['Medical decision-maker', has(t2.decisionMakerName)],
    ['Medications / allergies / conditions', has(t2.medications) || has(t2.allergiesConditions)],
    ['Go-bag checklist status', profile.goBagItems.length > 0],
    ['Your top next steps', steps.length > 0],
    ['Questions to ask about transport coverage', true],
  ];

  return (
    <ToolShell title="Holistic household plan" onClose={onClose}>
      <p className="tool-intro">One printable plan that pulls everything together for your household. Here's what's in it right now:</p>
      <div className="planlist">
        {bullets.map(([label, ready]) => (
          <div className={`planitem ${ready ? 'ready' : 'empty'}`} key={label}>
            <span className="pk">{ready ? '✓' : '○'}</span>
            <span>{label}{ready ? '' : ' — add via the tools above'}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={generate}>Generate &amp; print plan</button>
      </div>
    </ToolShell>
  );
}

/* ---------------------------------------------------------------------- shell */

function ToolShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="toolpanel">
      <div className="toolhead">
        <h4>{title}</h4>
        <button className="rowx" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {children}
    </div>
  );
}
