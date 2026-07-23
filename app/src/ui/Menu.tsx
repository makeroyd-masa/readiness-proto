import { Link } from 'react-router-dom';
import { SparkIcon } from './SparkIcon';

/**
 * Demo landing (/). Each surface is its own page that mimics a real context, so a
 * presenter can open exactly the one they want instead of toggling a dev switcher.
 */
const SURFACES: { to: string; title: string; desc: string; tag: string }[] = [
  {
    to: '/in-app',
    title: 'In-app experience',
    desc: 'The consumer app: SAM walks you through the full readiness check and builds your plan.',
    tag: 'Consumer',
  },
  {
    to: '/seminar-view',
    title: 'Seminar kiosk',
    desc: 'The shared tablet at a seminar — the non-medical questions in big buttons, then a code to finish at home.',
    tag: 'Kiosk',
  },
  {
    to: '/agent-view',
    title: 'Agent tablet',
    desc: "The MASA agent's view: look up a lead by their code, see their answers for a warm intro, track who finished.",
    tag: 'Agent',
  },
  {
    to: '/returning',
    title: 'Finish at home',
    desc: 'The lead returns with their code to complete the private, medical part of their plan.',
    tag: 'Lead',
  },
];

export function Menu() {
  return (
    <div className="sam-ui">
      <div className="stage">
        <div className="menu-hero">
          <div className="sam-badge">
            <SparkIcon size={22} />
          </div>
          <h1>Household Readiness</h1>
          <p>Pick a surface to demo. Each one mirrors a real moment in the journey.</p>
        </div>

        <div className="menu-list">
          {SURFACES.map((s) => (
            <Link key={s.to} to={s.to} className="menu-card">
              <div className="menu-card-top">
                <span className="menu-tag">{s.tag}</span>
                <span className="menu-chev">›</span>
              </div>
              <div className="menu-title">{s.title}</div>
              <div className="menu-desc">{s.desc}</div>
            </Link>
          ))}
        </div>

        <div className="footdisc">
          Internal prototype · synthetic data only. SAM offers guidance, not medical advice. In an emergency, call 911.
        </div>
      </div>
    </div>
  );
}
