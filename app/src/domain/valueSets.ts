/**
 * SINGLE SOURCE OF TRUTH for every enumerated value in the app.
 *
 * PRD v2 §18 / §19.2: the v1 prototype had dead personalization branches because
 * code referenced values ("distance", "travel" as a householdType) that did not
 * exist in the option lists. Every branch, score, and step selector in this app
 * MUST read its allowed values from here. If a value is not in these arrays, no
 * option can produce it and no branch may test for it.
 *
 * A dev-time guard (assertNoDeadBranches, see domain/guards.ts) checks that every
 * value referenced by the flow/scoring is a member of one of these sets.
 */

// ---- Tier 1: personalization facts (captured freely, no consent gate) ----

// v3: 'caregiver' removed — caregiving is now a separate aging-parent flag, not a
// household composition (HR-V3-03). householdType is pure composition.
export const HOUSEHOLD_TYPES = ['solo', 'couple', 'kids', 'multigen'] as const;
export type HouseholdType = (typeof HOUSEHOLD_TYPES)[number];

/** v3: aging-parent responsibility, decoupled from household type (HR-V3-03). */
export const AGING_PARENT = ['yes', 'no'] as const;
export type AgingParent = (typeof AGING_PARENT)[number];

/**
 * v3 three-level scenario answers (HR-V3-04) — map natively to good/watch/soon with
 * no new scoring primitive. Used by the who-to-call, who-takes-charge, and LTC-
 * conversation questions.
 */
export const SCENARIO_LEVELS = ['documented', 'informal', 'none'] as const;
export type ScenarioLevel = (typeof SCENARIO_LEVELS)[number];

/** v3 legal-authority depth (proxy / HIPAA) — documented / partial / none (HR-V3-06). */
export const AUTHORITY_LEVELS = ['documented', 'partial', 'none'] as const;
export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

/** v3 financial runway (Tier F) — how long the household could cover bills (HR-V3-05). */
export const RUNWAY_LEVELS = ['ample', 'some', 'little', 'unsure'] as const;
export type RunwayLevel = (typeof RUNWAY_LEVELS)[number];

/** Non-clinical: asks about advocacy ability, NOT diagnoses (PRD §7.1). */
export const VULNERABILITIES = ['none', 'cannot_advocate', 'young_kids'] as const;
export type Vulnerability = (typeof VULNERABILITIES)[number];

/**
 * Medical-half signal (2nd half, asked at home — never on the shared seminar screen).
 * Captures WHETHER medications/allergies/conditions exist and are documented, not the
 * clinical detail itself (that free-text lives in Tier 2). Feeds the Emergency
 * information score dimension.
 */
export const MEDICAL_NEEDS = ['none', 'undocumented', 'documented'] as const;
export type MedicalNeed = (typeof MEDICAL_NEEDS)[number];

export const GEO_RISKS = ['disaster', 'rural', 'travel', 'none'] as const;
export type GeoRisk = (typeof GEO_RISKS)[number];

export const ROLES = ['patient', 'caregiver_nearby', 'caregiver_remote'] as const;
export type Role = (typeof ROLES)[number];

export const TOP_WORRIES = ['info', 'chaos', 'cost', 'distance', 'not_sure'] as const;
export type TopWorry = (typeof TOP_WORRIES)[number];

export const MEMBER_STATUSES = ['member', 'prospect', 'unknown'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ENTRY_CONTEXTS = ['organic', 'in_app', 'seminar', 'shared_link'] as const;
export type EntryContext = (typeof ENTRY_CONTEXTS)[number];

/**
 * Current-state inventory (Stage 3) — drives the score.
 * NOTE: v1's "coverage" inventory item is intentionally REMOVED (PRD §8, §18):
 * coverage is no longer a scored input.
 */
// v3: 'contacts' and 'decision_maker' are promoted OUT of the inventory checklist into
// their own three-level scenario questions (Q2/Q3). Inventory keeps the fast-capture rest.
export const INVENTORY_ITEMS = [
  'meds_record',
  'go_bag',
  'written_plan',
] as const;
export type InventoryItem = (typeof INVENTORY_ITEMS)[number];

// ---- Scoring ----

/**
 * Family-controlled dimensions only. Coverage is NOT here (PRD §8).
 * v3 adds `financial_resilience` (always) and `long_term_care` (the personalized fifth
 * for aging-parent / multigen households; otherwise `personalized_fifth` is emitted).
 * A given profile scores exactly 6 dimensions.
 */
export const SCORE_DIMENSIONS = [
  'emergency_information',
  'people_and_roles',
  'supplies',
  'written_plan',
  'financial_resilience',
  'personalized_fifth',
  'long_term_care',
] as const;
export type ScoreDimensionId = (typeof SCORE_DIMENSIONS)[number];

export const DIMENSION_STATUSES = ['good', 'watch', 'soon'] as const;
export type DimensionStatus = (typeof DIMENSION_STATUSES)[number];

/**
 * Bands, ordered weakest -> strongest (PRD §8.2). This is a progress cue, never
 * a safety guarantee, and never a bare 100%. Cutoffs are TUNABLE (see scoring.ts).
 */
export const BANDS = [
  'Started',
  'Needs one key update',
  'Ready to share',
  'Ready for check-in',
] as const;
export type Band = (typeof BANDS)[number];

// ---- Delivery modes (PRD §5) ----

export const MODES = ['standard', 'seminar', 'returning', 'agent'] as const;
export type Mode = (typeof MODES)[number];

// ---- v3 sensitivity tiers (HR-V3-02, NF-09) ----

/**
 * P / M / F tier for every intake field. Tier P is publicly shareable (seminar screen +
 * agent view); Tier M (medical) and Tier F (financial) are completed at home only and
 * MUST NOT render on shared or agent-visible surfaces.
 */
export type Tier = 'P' | 'M' | 'F';
export const FIELD_TIER: Record<string, Tier> = {
  householdType: 'P',
  agingParent: 'P',
  role: 'P',
  contactsReadiness: 'P',
  decisionMaker: 'P',
  decisionAuthority: 'P',
  geoRisk: 'P',
  inventory: 'P',
  topWorry: 'P',
  ltcConversation: 'P',
  vulnerability: 'M',
  medicalNeeds: 'M',
  financialRunway: 'F',
};

/** True when a field is safe for the shared seminar screen / agent tablet (Tier P). */
export function isPublicField(field: string): boolean {
  return FIELD_TIER[field] === 'P';
}

// ---- helpers ----

/**
 * Map a three-level answer to a dimension status (HR-V3-04) — no new scoring primitive.
 * documented/ample → good; informal/partial/some → watch; none/little/unsure → soon;
 * null (not answered yet) → watch, so a seminar-only reveal isn't punitive.
 */
export function levelStatus(v: string | null | undefined): DimensionStatus {
  switch (v) {
    case 'documented':
    case 'ample':
      return 'good';
    case 'informal':
    case 'partial':
    case 'some':
      return 'watch';
    case 'none':
    case 'little':
    case 'unsure':
      return 'soon';
    default:
      return 'watch';
  }
}

export function isMember<T extends readonly string[]>(set: T, v: unknown): v is T[number] {
  return typeof v === 'string' && (set as readonly string[]).includes(v);
}
