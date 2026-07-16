import type { Profile } from '../domain/profile';
import { scoreProfile } from '../domain/scoring';
import { SamBubble } from './common';

/**
 * Returning mode (PRD §5.3): opens on WHAT CHANGED rather than re-asking intake.
 * Only possible because the standard/seminar modes persisted the profile. Replays
 * the stored file, re-scores, and offers to update just what's new.
 */
export function ReturningMode({
  profile,
  onReview,
  onUpdate,
}: {
  profile: Profile;
  onReview: () => void;
  onUpdate: () => void;
}) {
  const score = scoreProfile(profile);
  const t = profile.tier1;
  const summary = [
    t.householdType && `a ${labelHousehold(t.householdType)} household`,
    t.geoRisk && t.geoRisk !== 'none' && `${labelGeo(t.geoRisk)}`,
    t.topWorry && t.topWorry !== 'not_sure' && `most worried about ${labelWorry(t.topWorry)}`,
  ]
    .filter(Boolean)
    .join(', ');

  const lastVisit = profile.events.length ? new Date(profile.updatedAt).toLocaleDateString() : null;

  return (
    <div className="stage">
      <SamBubble>
        Welcome back. Last time you told me you're {summary || 'building your readiness file'}
        {lastVisit ? ` (last updated ${lastVisit})` : ''}. Your file is at <strong>{score.band}</strong> — I won't
        start over. What's changed?
      </SamBubble>

      <div className="followwrap" style={{ marginTop: 4 }}>
        <div className="chiprow">
          <button className="chip-btn" onClick={onUpdate}>
            <span className="ci">🔄</span> Something changed — update my answers
          </button>
          <button className="chip-btn" onClick={onReview}>
            <span className="ci">📄</span> Nothing changed — review my file
          </button>
        </div>
      </div>

      <div className="footdisc">
        This is the evergreen engine: re-scoring and regenerating from a stored profile, asking only what's new.
      </div>
    </div>
  );
}

const labelHousehold = (v: string) => ({ solo: 'solo', couple: 'couple', kids: 'family-with-kids', multigen: 'multi-generational', caregiver: 'caregiver' })[v] ?? v;
const labelGeo = (v: string) => ({ disaster: 'in a disaster-prone area', rural: 'rural or far from a hospital', travel: 'often traveling' })[v] ?? v;
const labelWorry = (v: string) => ({ info: 'having the right info', chaos: 'chaos in the moment', cost: 'cost', distance: 'distance from care' })[v] ?? v;
