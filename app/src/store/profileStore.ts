/**
 * Profile persistence (PRD HR-I-03, §6.2, §19.1).
 *
 * The v1 prototype kept everything in memory. Here the Family Readiness File is
 * persisted to localStorage, keyed by an anonymous session id that could later be
 * promoted to an account. This is what makes returning/change-detection mode
 * possible and satisfies the "persists across reload" acceptance check (§19.7).
 *
 * Throwaway internal prototype: localStorage is deliberate (no backend, synthetic
 * data only, no real PHI). A server-backed store swaps in behind this same module.
 */

import { emptyProfile, SCHEMA_VERSION, type Profile, type ProfileEvent } from '../domain/profile';

const SESSION_KEY = 'sam.sessionId';
const profileKey = (id: string) => `sam.profile.${id}`;

function now(): string {
  return new Date().toISOString();
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = newSessionId();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Load the persisted profile for this session, or create a fresh one. */
export function loadProfile(sessionId = getSessionId()): Profile {
  const raw = localStorage.getItem(profileKey(sessionId));
  if (!raw) return emptyProfile(sessionId, now());
  try {
    const parsed = JSON.parse(raw) as Profile;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      // Future: migrate. For the prototype, start clean on version mismatch.
      return emptyProfile(sessionId, now());
    }
    return parsed;
  } catch {
    return emptyProfile(sessionId, now());
  }
}

export function saveProfile(p: Profile): Profile {
  const updated: Profile = { ...p, updatedAt: now() };
  if (updated.consent.saveProfile) {
    localStorage.setItem(profileKey(updated.sessionId), JSON.stringify(updated));
  }
  return updated;
}

/** Append an event to the log (change detection / analytics) and persist. */
export function logEvent(p: Profile, type: string, detail?: Record<string, unknown>): Profile {
  const event: ProfileEvent = { at: now(), type, detail };
  return saveProfile({ ...p, events: [...p.events, event] });
}

export function resetProfile(sessionId = getSessionId()): Profile {
  localStorage.removeItem(profileKey(sessionId));
  return emptyProfile(sessionId, now());
}

/** Wipe everything (dev helper for the mode switcher / demo reset). */
export function hardReset(): void {
  const id = localStorage.getItem(SESSION_KEY);
  if (id) localStorage.removeItem(profileKey(id));
  localStorage.removeItem(SESSION_KEY);
}
