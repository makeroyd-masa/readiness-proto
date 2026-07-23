/**
 * The Family Readiness File — the profile spine (PRD §6.2, §7).
 * Every node reads and writes this object. It is persisted (see store/), never
 * in-memory-only (PRD §18 fix).
 *
 * Two-tier data model (PRD §7):
 *  - Tier 1 personalization facts: low risk, captured freely.
 *  - Tier 2 sensitive artifact fields: consent-gated, default finish-at-home,
 *    NEVER required to see the score or the plan.
 */

import type {
  AgingParent,
  AuthorityLevel,
  EntryContext,
  GeoRisk,
  HouseholdType,
  InventoryItem,
  MedicalNeed,
  MemberStatus,
  Role,
  RunwayLevel,
  ScenarioLevel,
  TopWorry,
  Vulnerability,
} from './valueSets';

/** Tier 1 — personalization facts. (v3 adds resilience + tier-P scenario fields.) */
export interface Tier1 {
  householdType: HouseholdType | null;
  /** v3: aging-parent responsibility, decoupled from household type (HR-V3-03). */
  agingParent: AgingParent | null;
  vulnerability: Vulnerability | null;
  /** Medical-half signal (2nd half, at home): meds/allergies/conditions present + documented. */
  medicalNeeds: MedicalNeed | null;
  geoRisk: GeoRisk | null;
  role: Role | null;
  topWorry: TopWorry | null;
  /** v3 Q2 (Tier P): does everyone know who to call first? */
  contactsReadiness: ScenarioLevel | null;
  /** v3 Q3 (Tier P): is there one person who could take charge? */
  decisionMaker: ScenarioLevel | null;
  /** v3 Q4 (Tier P, home half): legal paperwork to act (proxy / HIPAA). */
  decisionAuthority: AuthorityLevel | null;
  /** v3 Q11 (Tier P): has the household talked about long-term care? */
  ltcConversation: ScenarioLevel | null;
  /** v3 Q10 (Tier F, home only): financial runway if a wage-earner is out 3 months. */
  financialRunway: RunwayLevel | null;
  memberStatus: MemberStatus; // defaults to 'unknown'
  entryContext: EntryContext; // defaults to 'organic'
  inventory: InventoryItem[]; // Stage 3 current-state, drives score
}

/** A single emergency contact row (People & roles tool). */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/** Tier 2 — sensitive artifact fields. Only set after explicit consent. */
export interface Tier2 {
  householdLabel: string | null;
  medications: string | null;
  allergiesConditions: string | null;
  /** Legacy single-line contact (kept for the wallet card); primary of `contacts`. */
  emergencyContact: string | null;
  /** Structured contact list built via the People & roles tool. */
  contacts: EmergencyContact[];
  /** Named medical decision-maker (People & roles tool). */
  decisionMakerName: string | null;
  /** 'yes' | 'no' | 'not_sure' — "I'm not sure" is a first-class answer (PRD §4). */
  decisionMakerStatus: 'yes' | 'no' | 'not_sure' | null;
}

/** Granular, independently revocable consent flags (PRD §7.3). */
export interface Consent {
  saveProfile: boolean;
  shareWithHousehold: boolean;
  shareWithAdvocate: boolean;
  healthInfoAcknowledged: boolean; // gates Tier 2 capture
}

export type ArtifactForm = 'living_file' | 'pdf_snapshot' | 'wallet_card';

/** Append-only event log — enables change detection / returning mode (PRD §5.3, NF-05). */
export interface ProfileEvent {
  at: string; // ISO timestamp
  type: string; // e.g. 'answer', 'artifact_built', 'coverage_viewed', 'handoff'
  detail?: Record<string, unknown>;
}

export interface Profile {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  tier1: Tier1;
  tier2: Tier2;
  consent: Consent;
  artifactsBuilt: ArtifactForm[];
  /** Checked go-bag / medication-supply items (Go-bag tool). */
  goBagItems: string[];
  coverageViewed: boolean;
  checkinSet: boolean;
  /** The seminar follow-up code this session is finishing under (set on resume). */
  activeCode: string | null;
  events: ProfileEvent[];
  /** schema version, so a persisted profile can be migrated later. */
  schemaVersion: number;
}

export const SCHEMA_VERSION = 3;

export function emptyProfile(sessionId: string, now: string): Profile {
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    tier1: {
      householdType: null,
      agingParent: null,
      vulnerability: null,
      medicalNeeds: null,
      geoRisk: null,
      role: null,
      topWorry: null,
      contactsReadiness: null,
      decisionMaker: null,
      decisionAuthority: null,
      ltcConversation: null,
      financialRunway: null,
      memberStatus: 'unknown',
      entryContext: 'organic',
      inventory: [],
    },
    tier2: {
      householdLabel: null,
      medications: null,
      allergiesConditions: null,
      emergencyContact: null,
      contacts: [],
      decisionMakerName: null,
      decisionMakerStatus: null,
    },
    consent: {
      saveProfile: true,
      shareWithHousehold: false,
      shareWithAdvocate: false,
      healthInfoAcknowledged: false,
    },
    artifactsBuilt: [],
    goBagItems: [],
    coverageViewed: false,
    checkinSet: false,
    activeCode: null,
    events: [],
    schemaVersion: SCHEMA_VERSION,
  };
}

export function hasInventory(p: Profile, item: InventoryItem): boolean {
  return p.tier1.inventory.includes(item);
}

/** True once any Tier-1 intake answer exists — used to distinguish new vs returning. */
export function hasIntake(p: Profile): boolean {
  const t = p.tier1;
  return Boolean(t.householdType || t.vulnerability || t.geoRisk || t.topWorry || t.inventory.length);
}
