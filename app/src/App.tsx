import { Routes, Route, Navigate } from 'react-router-dom';
import './ui/theme.css';
import { assertFlowIntegrity } from './engine/guards';
import { householdReadinessFlow } from './content/flow';
import { Menu } from './ui/Menu';
import { InApp } from './ui/InApp';
import { SeminarMode } from './ui/SeminarMode';
import { AgentMode } from './ui/AgentMode';
import { Returning } from './ui/Returning';
import { useDemoProfile } from './ui/useDemoProfile';

// Dev-time integrity check — makes the v1 dead-branch class of bug fail loudly (§18).
if (import.meta.env.DEV) assertFlowIntegrity(householdReadinessFlow);

/**
 * Thin app shell: the AccessNow topbar chrome + client-side routes. Each surface is
 * its own shareable page (menu / in-app / seminar / agent / returning) — the old
 * dev-bar mode switcher is gone (PRD demo request).
 */
export default function App() {
  return (
    <div className="device">
      <div className="topbar">
        <img className="mark" src={`${import.meta.env.BASE_URL}masa-icon.jpg`} alt="MASA" />
        <div className="brandwrap">
          <span className="sam">AccessNow</span>
          <span className="by">by MASA</span>
        </div>
        <span className="tag">READINESS CHECK</span>
      </div>

      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/in-app" element={<InApp />} />
        <Route path="/seminar-view" element={<SeminarView />} />
        <Route path="/agent-view" element={<AgentMode />} />
        <Route path="/returning" element={<Returning />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

/** Seminar kiosk surface — kept as-is; just given its own fresh demo profile. */
function SeminarView() {
  const { profile, commit, track } = useDemoProfile();
  return <SeminarMode profile={profile} commit={commit} track={track} />;
}
