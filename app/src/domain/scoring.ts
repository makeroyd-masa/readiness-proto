/**
 * Readiness scoring (PRD §8, §19.4).
 *
 *  - Measures ONLY what the family controls. Coverage is NOT a dimension.
 *  - Pure and reproducible: identical profile -> identical output (NF-06).
 *  - Never outputs 100% (displayPct capped). Presented as bands, %fallback secondary.
 *  - Weighting: each dimension weighted by presence-in-inventory, then weights are
 *    RAISED for vulnerability / geo signals so an unmet-but-important gap pulls the
 *    score down (that gap "matters more for you").
 *
 * The band cutoffs and the personalized-fifth mapping below are a defensible FIRST
 * PASS, explicitly TUNABLE. They are not final product values (flagged to reviewers).
 */

import { BANDS, type Band, type DimensionStatus, type ScoreDimensionId } from './valueSets';
import { hasInventory, type Profile } from './profile';

export interface ScoredDimension {
  id: ScoreDimensionId;
  name: string;
  status: DimensionStatus;
  weight: number;
}

export interface Score {
  dimensions: ScoredDimension[];
  fraction: number; // 0..1, weighted
  displayPct: number; // capped, for optional secondary display
  band: Band;
  solidCount: number;
}

const STATUS_VALUE: Record<DimensionStatus, number> = { good: 1, watch: 0.45, soon: 0.15 };
const DISPLAY_CAP = 92; // never present 100% (PRD §8.2 / v1 mechanic)

// Weight bumps when a risk signal makes an unmet dimension matter more.
const RAISED = 1.7;
const BASE = 1;

function hasVulnerability(p: Profile): boolean {
  return p.tier1.vulnerability != null && p.tier1.vulnerability !== 'none';
}
function highGeo(p: Profile): boolean {
  return p.tier1.geoRisk === 'disaster' || p.tier1.geoRisk === 'rural';
}

/**
 * The personalized fifth dimension, chosen by household type (PRD §8.1, §19.5).
 * Each type's "good" condition is tied to inventory signals so a fully-prepared
 * household (any type) CAN reach the top band on its own preparation (§8.2) — the
 * fifth is not an unreachable ceiling.
 */
function personalizedFifth(p: Profile): ScoredDimension {
  const base = { id: 'personalized_fifth' as const, weight: BASE };
  const has = (i: Parameters<typeof hasInventory>[1]) => hasInventory(p, i);
  const documented = has('written_plan') || (has('contacts') && has('decision_maker'));
  switch (p.tier1.householdType) {
    case 'caregiver': {
      // escalates when the caregiver is remote (role) — a real branch with a real value.
      const remote = p.tier1.role === 'caregiver_remote';
      const good = has('decision_maker'); // authorizations to coordinate care are lined up
      return {
        ...base,
        name: 'Remote coordination access',
        status: good ? 'good' : remote ? 'soon' : 'watch',
        weight: remote && !good ? RAISED : BASE,
      };
    }
    case 'multigen':
      return { ...base, name: 'Roles across generations', status: documented ? 'good' : 'watch' };
    case 'kids':
      return { ...base, name: "Kids' emergency instructions", status: has('contacts') || documented ? 'good' : 'watch' };
    case 'couple':
      return { ...base, name: 'Mutual backup (each can speak for the other)', status: has('decision_maker') ? 'good' : 'watch' };
    case 'solo':
    default: {
      const good = has('contacts') || has('decision_maker'); // a trusted person can act
      return {
        ...base,
        name: 'Solo emergency backup',
        status: good ? 'good' : hasVulnerability(p) ? 'soon' : 'watch',
        weight: hasVulnerability(p) && !good ? RAISED : BASE,
      };
    }
  }
}

export function scoreProfile(p: Profile): Score {
  const cardBuilt = p.artifactsBuilt.includes('living_file') || Boolean(p.tier2.medications || p.tier2.allergiesConditions);

  const dims: ScoredDimension[] = [];

  // 1. Emergency information — driven by the 2nd-half medical question (medicalNeeds),
  //    a "have a meds list" inventory item, or a built card. `undocumented` is the
  //    actionable gap; `documented`/`none` are handled. Null (seminar-only, not yet
  //    at the medical half) falls back to the vulnerability signal.
  const mn = p.tier1.medicalNeeds;
  const emInfoGood = hasInventory(p, 'meds_record') || cardBuilt || mn === 'documented' || mn === 'none';
  const emInfoSoon = mn === 'undocumented' || (mn == null && hasVulnerability(p));
  dims.push({
    id: 'emergency_information',
    name: 'Emergency information',
    status: emInfoGood ? 'good' : emInfoSoon ? 'soon' : 'watch',
    weight: hasVulnerability(p) || mn === 'undocumented' ? RAISED : BASE,
  });

  // 2. People & roles — findable contacts + decision-maker named where relevant.
  //    Satisfied by the seminar inventory OR by the People & roles tool's writes.
  const contacts = hasInventory(p, 'contacts') || p.tier2.contacts.length > 0;
  const dm =
    hasInventory(p, 'decision_maker') ||
    p.tier2.decisionMakerStatus === 'yes' ||
    Boolean(p.tier2.decisionMakerName);
  const dmNeeded = hasVulnerability(p) || p.tier1.householdType !== 'solo';
  const peopleGood = contacts && (dm || !dmNeeded);
  dims.push({
    id: 'people_and_roles',
    name: 'People & roles',
    status: peopleGood ? 'good' : contacts ? 'watch' : dmNeeded ? 'soon' : 'watch',
    weight: hasVulnerability(p) ? RAISED : BASE,
  });

  // 3. Supplies — go-bag / several days of medication supply.
  dims.push({
    id: 'supplies',
    name: 'Supplies (go-bag / medication supply)',
    status: hasInventory(p, 'go_bag') ? 'good' : highGeo(p) ? 'soon' : 'watch',
    weight: highGeo(p) ? RAISED : BASE,
  });

  // 4. Written household plan — one place the household can find (the artifact satisfies much of this).
  const planned = hasInventory(p, 'written_plan') || p.artifactsBuilt.includes('living_file');
  dims.push({
    id: 'written_plan',
    name: 'Written household plan',
    status: planned ? 'good' : 'watch',
    weight: BASE,
  });

  // 5. Personalized fifth.
  dims.push(personalizedFifth(p));

  const totalWeight = dims.reduce((a, d) => a + d.weight, 0);
  const weighted = dims.reduce((a, d) => a + STATUS_VALUE[d.status] * d.weight, 0);
  const fraction = totalWeight === 0 ? 0 : weighted / totalWeight;

  return {
    dimensions: dims,
    fraction,
    displayPct: Math.min(Math.round(fraction * 100), DISPLAY_CAP),
    band: bandFor(fraction),
    solidCount: dims.filter((d) => d.status === 'good').length,
  };
}

/** TUNABLE cutoffs. Bands ascend weakest -> strongest. */
export function bandFor(fraction: number): Band {
  if (fraction < 0.4) return BANDS[0]; // Started
  if (fraction < 0.7) return BANDS[1]; // Needs one key update
  if (fraction < 0.9) return BANDS[2]; // Ready to share
  return BANDS[3]; // Ready for check-in
}
