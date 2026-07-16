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

export const HOUSEHOLD_TYPES = ['solo', 'couple', 'kids', 'multigen', 'caregiver'] as const;
export type HouseholdType = (typeof HOUSEHOLD_TYPES)[number];

/** Non-clinical: asks about advocacy ability, NOT diagnoses (PRD §7.1). */
export const VULNERABILITIES = ['none', 'cannot_advocate', 'young_kids'] as const;
export type Vulnerability = (typeof VULNERABILITIES)[number];

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
export const INVENTORY_ITEMS = [
  'meds_record',
  'contacts',
  'decision_maker',
  'go_bag',
  'written_plan',
] as const;
export type InventoryItem = (typeof INVENTORY_ITEMS)[number];

// ---- Scoring ----

/** Family-controlled dimensions only. Coverage is NOT here (PRD §8). */
export const SCORE_DIMENSIONS = [
  'emergency_information',
  'people_and_roles',
  'supplies',
  'written_plan',
  'personalized_fifth',
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

export const MODES = ['standard', 'seminar', 'returning'] as const;
export type Mode = (typeof MODES)[number];

// ---- helpers ----

export function isMember<T extends readonly string[]>(set: T, v: unknown): v is T[number] {
  return typeof v === 'string' && (set as readonly string[]).includes(v);
}
