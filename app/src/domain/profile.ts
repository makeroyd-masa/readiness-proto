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
  EntryContext,
  GeoRisk,
  HouseholdType,
  InventoryItem,
  MemberStatus,
  Role,
  TopWorry,
  Vulnerability,
} from './valueSets';

/** Tier 1 — personalization facts. */
export interface Tier1 {
  householdType: HouseholdType | null;
  vulnerability: Vulnerability | null;
  geoRisk: GeoRisk | null;
  role: Role | null;
  topWorry: TopWorry | null;
  memberStatus: MemberStatus; // defaults to 'unknown'
  entryContext: EntryContext; // defaults to 'organic'
  inventory: InventoryItem[]; // Stage 3 current-state, drives score
}

/** Tier 2 — sensitive artifact fields. Only set after explicit consent. */
export interface Tier2 {
  householdLabel: string | null;
  medications: string | null;
  allergiesConditions: string | null;
  emergencyContact: string | null;
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
  coverageViewed: boolean;
  checkinSet: boolean;
  events: ProfileEvent[];
  /** schema version, so a persisted profile can be migrated later. */
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;

export function emptyProfile(sessionId: string, now: string): Profile {
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    tier1: {
      householdType: null,
      vulnerability: null,
      geoRisk: null,
      role: null,
      topWorry: null,
      memberStatus: 'unknown',
      entryContext: 'organic',
      inventory: [],
    },
    tier2: {
      householdLabel: null,
      medications: null,
      allergiesConditions: null,
      emergencyContact: null,
      decisionMakerStatus: null,
    },
    consent: {
      saveProfile: true,
      shareWithHousehold: false,
      shareWithAdvocate: false,
      healthInfoAcknowledged: false,
    },
    artifactsBuilt: [],
    coverageViewed: false,
    checkinSet: false,
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
