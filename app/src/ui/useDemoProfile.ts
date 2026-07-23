import { useState } from 'react';
import { emptyProfile, type Profile } from '../domain/profile';
import { getSessionId } from '../store/profileStore';

/**
 * Per-surface profile state for the demo. Each routed surface (in-app, seminar,
 * returning) owns a fresh, in-memory profile so demos start clean and surfaces don't
 * contaminate each other. The seminar → returning handoff persists separately via the
 * code store (store/codeStore.ts); the profile itself is deliberately not persisted.
 */
export function useDemoProfile(seed?: (base: Profile) => Profile): {
  profile: Profile;
  commit: (next: Profile) => void;
  track: (type: string, detail?: Record<string, unknown>) => void;
} {
  const [profile, setProfile] = useState<Profile>(() => {
    const base = emptyProfile(getSessionId(), new Date().toISOString());
    return seed ? seed(base) : base;
  });

  const commit = (next: Profile) => setProfile({ ...next, updatedAt: new Date().toISOString() });
  const track = (type: string, detail?: Record<string, unknown>) =>
    setProfile((p) => ({ ...p, events: [...p.events, { at: new Date().toISOString(), type, detail }] }));

  return { profile, commit, track };
}
