import { StandardMode } from './StandardMode';
import { useDemoProfile } from './useDemoProfile';

/**
 * The in-app "SAM" consumer surface (/in-app). Runs the full readiness flow end-to-end
 * and adopts the masa-sam-advocate look via the `.sam-ui` scope (fonts, SAM badge,
 * .sam-msg bubbles, chip options, pill buttons, answer-card summary). Flow/engine/
 * scoring are unchanged — only the presentation differs.
 */
export function InApp() {
  const { profile, commit, track } = useDemoProfile();
  return (
    <div className="sam-ui">
      <StandardMode profile={profile} commit={commit} track={track} />
    </div>
  );
}
