/**
 * Simulated seminar code store (the honest stand-in for the real backend).
 *
 * The seminar loop's promise is that a short CODE carries the lead's non-medical
 * 1st-half answers across surfaces: the kiosk they answered on, the AGENT's tablet
 * (warm intro + tie code → attendee name + see who finished), and the finish-at-home
 * screen. That is inherently shared state keyed by the code.
 *
 * This prototype has no backend (deliberate, throwaway scope), so the store is a
 * localStorage map keyed by code. Within one browser the code genuinely restores the
 * answers — enough to demonstrate the entire mechanic. TRUE cross-device (answer on a
 * kiosk, finish on the lead's own phone) is the one gap the real backend closes later;
 * everything here swaps behind the same interface.
 */

import type { Profile, Tier1 } from '../domain/profile';

const PREFIX = 'sam.byCode.';
const codeKey = (code: string) => `${PREFIX}${normalize(code)}`;

export type CodeStatus = 'seminar_started' | 'completed';

export interface CodeRecord {
  code: string;
  /** Full Tier-1 snapshot captured at the seminar (the non-medical 1st half). */
  tier1: Tier1;
  /** Attendee name the agent attaches on their tablet (demo). */
  attendeeName: string | null;
  status: CodeStatus;
  createdAt: string;
  updatedAt: string;
}

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

function now(): string {
  return new Date().toISOString();
}

function read(code: string): CodeRecord | null {
  try {
    const raw = localStorage.getItem(codeKey(code));
    return raw ? (JSON.parse(raw) as CodeRecord) : null;
  } catch {
    return null;
  }
}

function write(rec: CodeRecord): void {
  localStorage.setItem(codeKey(rec.code), JSON.stringify(rec));
}

/**
 * Save (or refresh) the snapshot behind a code. Preserves an existing record's
 * attendeeName and createdAt so the agent's name binding survives a re-save.
 */
export function saveCodeSnapshot(code: string, profile: Profile, status: CodeStatus): CodeRecord {
  const existing = read(code);
  const rec: CodeRecord = {
    code: normalize(code),
    tier1: profile.tier1,
    attendeeName: existing?.attendeeName ?? null,
    status,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  write(rec);
  return rec;
}

export function getCodeSnapshot(code: string): CodeRecord | null {
  return read(code);
}

/** All records, newest first — powers the agent tablet list. */
export function listCodes(): CodeRecord[] {
  const out: CodeRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      const rec = JSON.parse(localStorage.getItem(key) as string) as CodeRecord;
      if (rec && rec.code) out.push(rec);
    } catch {
      /* skip malformed */
    }
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function setAttendeeName(code: string, name: string): void {
  const rec = read(code);
  if (!rec) return;
  rec.attendeeName = name.trim() || null;
  rec.updatedAt = now();
  write(rec);
}

export function setCodeStatus(code: string, status: CodeStatus): void {
  const rec = read(code);
  if (!rec) return;
  rec.status = status;
  rec.updatedAt = now();
  write(rec);
}
