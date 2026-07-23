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

import { BANDS, levelStatus, type Band, type DimensionStatus, type ScoreDimensionId } from './valueSets';
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

/** A contact list is findable / a decision-maker is named — read from the v3 scenario
 *  fields (and the People & roles tool, which writes them). */
function contactsDocumented(p: Profile): boolean {
  return p.tier1.contactsReadiness === 'documented' || p.tier2.contacts.length > 0;
}
function decisionMakerNamed(p: Profile): boolean {
  return (
    p.tier1.decisionMaker === 'documented' ||
    p.tier1.decisionMaker === 'informal' ||
    Boolean(p.tier2.decisionMakerName) ||
    p.tier2.decisionMakerStatus === 'yes'
  );
}

/**
 * The personalized fifth dimension (PRD §8.1, §19.5).
 * v3: aging-parent responsibility or a multi-generational household routes to
 * Long-term-care planning (HR-V3-05); every other composition keeps a v2-style fifth.
 * The `caregiver` composition case is gone (caregiving is now the aging-parent flag).
 */
function personalizedFifth(p: Profile): ScoredDimension {
  // Long-term-care planning becomes the fifth where it applies.
  if (p.tier1.agingParent === 'yes' || p.tier1.householdType === 'multigen') {
    const remote = p.tier1.agingParent === 'yes' && p.tier1.role === 'caregiver_remote';
    const status = levelStatus(p.tier1.ltcConversation);
    return {
      id: 'long_term_care',
      name: 'Long-term-care planning',
      status,
      weight: remote && status !== 'good' ? RAISED : BASE,
    };
  }

  const base = { id: 'personalized_fifth' as const, weight: BASE };
  const documented = hasInventory(p, 'written_plan') || (contactsDocumented(p) && decisionMakerNamed(p));
  switch (p.tier1.householdType) {
    case 'kids':
      return { ...base, name: "Kids' emergency instructions", status: contactsDocumented(p) || documented ? 'good' : 'watch' };
    case 'couple':
      return { ...base, name: 'Mutual backup (each can speak for the other)', status: decisionMakerNamed(p) ? 'good' : 'watch' };
    case 'solo':
    default: {
      const good = contactsDocumented(p) || decisionMakerNamed(p); // a trusted person can act
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

  // 2. People & roles — v3 depth (HR-V3-06): findable contacts + a named decision-maker
  //    WITH signed legal authority (proxy / HIPAA). Informal scores watch; a real gap
  //    (no contacts or no decision-maker) scores soon.
  const cr = p.tier1.contactsReadiness;
  const dm = p.tier1.decisionMaker;
  const auth = p.tier1.decisionAuthority;
  const contactsGap = cr === 'none' && p.tier2.contacts.length === 0;
  const dmGap = dm === 'none' && !decisionMakerNamed(p);
  const authDocumented = auth === 'documented';
  const peopleGood = contactsDocumented(p) && decisionMakerNamed(p) && authDocumented;
  dims.push({
    id: 'people_and_roles',
    name: 'People & roles',
    status: contactsGap || dmGap ? 'soon' : peopleGood ? 'good' : 'watch',
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

  // 5. Financial resilience — v3 (HR-V3-05). Scored on runway, never on products.
  //    Null (not yet answered at home) → watch, so the seminar reveal isn't punitive.
  dims.push({
    id: 'financial_resilience',
    name: 'Financial resilience',
    status: levelStatus(p.tier1.financialRunway),
    weight: BASE,
  });

  // 6. Personalized fifth (long-term-care planning where it applies).
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

/**
 * Band cutoffs, re-baselined against representative personas for the v3 six-dimension
 * model (HR-V3-10; see verify.ts "Persona baseline"). Bands ascend weakest -> strongest.
 * The top cutoff (0.93) means "Ready for check-in" requires essentially everything solid:
 * a single unmet dimension (e.g. a financial cushion still at "watch") lands in
 * "Ready to share", not the maintenance band. Order confirmed as the intuitive ascent.
 */
export function bandFor(fraction: number): Band {
  if (fraction < 0.4) return BANDS[0]; // Started — real gaps across the board
  if (fraction < 0.7) return BANDS[1]; // Needs one key update — some in place, meaningful gaps
  if (fraction < 0.93) return BANDS[2]; // Ready to share — solid, a watch item or two
  return BANDS[3]; // Ready for check-in — everything solid, maintenance mode
}
