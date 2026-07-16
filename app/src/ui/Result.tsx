import { useState } from 'react';
import type { Profile } from '../domain/profile';
import { scoreProfile } from '../domain/scoring';
import { nextSteps, type RankedStep } from '../domain/steps';
import { getEvidence } from '../content/evidence';
import { coverageCopy, COVERAGE_QUESTIONS, MASA_STATS } from '../content/coverage';
import { Mark, SamBubble, Scorecard } from './common';
import { printFullFile, printWalletCard } from './print';

interface Props {
  profile: Profile;
  commit: (next: Profile) => void;
  track: (type: string, detail?: Record<string, unknown>) => void;
}

const BAND_OPENER: Record<string, string> = {
  Started: "Good news: you showed up. You've got real gaps, but they're fixable — and I've picked the three that matter most.",
  'Needs one key update': "You're close. One key piece stands out, and closing it makes the biggest difference.",
  'Ready to share': "You're in good shape — solid enough to share this plan with your household.",
  'Ready for check-in': "You're ahead of most households. From here it's about keeping things current.",
};

const STATUS_META: Record<string, [string, string, string]> = {
  good: ['#1c7a45', 'chip-good', 'In good shape'],
  watch: ['#d99311', 'chip-watch', 'Worth addressing'],
  soon: ['var(--masa-flare)', 'chip-soon', 'Do this soon'],
};

export function Result({ profile, commit, track }: Props) {
  const score = scoreProfile(profile);
  const steps = nextSteps(profile);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [chipsDone, setChipsDone] = useState<Set<string>>(new Set());
  const [t2, setT2] = useState({
    householdLabel: profile.tier2.householdLabel ?? '',
    medications: profile.tier2.medications ?? '',
    allergiesConditions: profile.tier2.allergiesConditions ?? '',
    emergencyContact: profile.tier2.emergencyContact ?? '',
  });

  const markChip = (id: string) => setChipsDone((s) => new Set(s).add(id));

  function openCoverage() {
    if (!coverageOpen) {
      setCoverageOpen(true);
      track('coverage_viewed', { variant: profile.tier1.memberStatus });
      commit({ ...profile, coverageViewed: true });
    }
  }

  function saveTier2() {
    const next: Profile = {
      ...profile,
      tier2: { ...profile.tier2, ...t2, decisionMakerStatus: profile.tier2.decisionMakerStatus },
      consent: { ...profile.consent, healthInfoAcknowledged: true },
      artifactsBuilt: Array.from(new Set([...profile.artifactsBuilt, 'living_file'])),
    };
    commit(next);
    track('artifact_built', { form: 'living_file' });
    setConsentOpen(false);
  }

  return (
    <>
      <SamBubble>
        Here's where your household stands. {BAND_OPENER[score.band]}
      </SamBubble>

      {/* Scorecard — band first, % secondary (PRD §8.2) */}
      <Scorecard score={score} />

      {/* Dimensions — coverage is deliberately NOT here (PRD §8) */}
      <div className="section-h">Your readiness, area by area</div>
      {score.dimensions.map((d) => {
        const m = STATUS_META[d.status];
        return (
          <div className="dim" key={d.id}>
            <span className="dot" style={{ background: m[0] }} />
            <span className="dname">{d.name}</span>
            <span className={`chip ${m[1]}`}>{m[2]}</span>
          </div>
        );
      })}

      {/* Top 3 next steps */}
      <div className="section-h">Your top 3 next steps</div>
      {steps.map((s, i) => (
        <StepCard key={s.id} step={s} index={i} onCoverage={openCoverage} />
      ))}

      {/* Artifact — ungated (PRD §4 / HR-I-05) */}
      <div className="section-h">The file SAM made for you</div>
      <ArtifactCard
        profile={profile}
        onDownloadFile={() => {
          printFullFile(profile, score, steps);
          track('artifact_delivered', { form: 'pdf_snapshot' });
        }}
        onPrintCard={() => {
          printWalletCard(profile);
          track('artifact_delivered', { form: 'wallet_card' });
        }}
        onAddDetails={() => setConsentOpen(true)}
      />
      <p className="optional-note" style={{ marginLeft: 2 }}>
        You can download the full file now — you never have to open the coverage conversation to get it.
      </p>

      {consentOpen && (
        <div className="consent">
          <h4>Add your emergency details?</h4>
          <p>
            This is not a medical record. You control what is saved and shared, and you can add any of this
            now or finish it privately at home. Everything here is optional.
          </p>
          <div className="tier2form">
            <label>Name or household label</label>
            <input value={t2.householdLabel} onChange={(e) => setT2({ ...t2, householdLabel: e.target.value })} placeholder="e.g. Robert M." />
            <label>Daily medications <span className="optional-note">(optional)</span></label>
            <input value={t2.medications} onChange={(e) => setT2({ ...t2, medications: e.target.value })} placeholder="e.g. Metoprolol, Eliquis" />
            <label>Allergies / conditions <span className="optional-note">(optional)</span></label>
            <input value={t2.allergiesConditions} onChange={(e) => setT2({ ...t2, allergiesConditions: e.target.value })} placeholder="e.g. Penicillin; AFib" />
            <label>Emergency contact <span className="optional-note">(optional)</span></label>
            <input value={t2.emergencyContact} onChange={(e) => setT2({ ...t2, emergencyContact: e.target.value })} placeholder="e.g. Susan M. (daughter) 555-0142" />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-ghost" onClick={() => setConsentOpen(false)}>
              Finish later on my device
            </button>
            <button className="btn btn-primary" onClick={saveTier2}>
              Save to my file
            </button>
          </div>
        </div>
      )}

      {/* Coverage — optional education module, shown only when opened (PRD §9) */}
      {coverageOpen && <CoverageModule profile={profile} track={track} />}

      {/* Follow-up chips (PRD HR-I-11) */}
      <div className="section-h">What next?</div>
      <div className="followwrap">
        <div className="followlabel">Tap to keep going — SAM adapts as you do:</div>
        <div className="chiprow">
          <Chip id="details" done={chipsDone} icon="🪪" label="Add or update my emergency details" onClick={() => { markChip('details'); setConsentOpen(true); }} />
          <Chip
            id="coverage"
            done={chipsDone}
            icon="🚑"
            label={profile.tier1.memberStatus === 'member' ? 'How does my MASA coverage apply?' : 'Understand my emergency-transport coverage'}
            onClick={() => { markChip('coverage'); openCoverage(); }}
          />
          <Chip id="share" done={chipsDone} icon="📤" label="Share this so my household can add their part" onClick={() => { markChip('share'); track('share_started'); alert('Prototype: creates a shareable link; a second member opens it, adds their part, and it merges into the file.'); }} />
          <Chip id="checkin" done={chipsDone} icon="🔁" label="Have SAM check in as things change" onClick={() => { markChip('checkin'); commit({ ...profile, checkinSet: true }); track('checkin_set'); }} />
          <Chip id="human" done={chipsDone} icon="💬" label="I'd rather talk to a person" onClick={() => { markChip('human'); track('advocate_handoff', { consented: profile.consent.shareWithAdvocate }); alert('Prototype: hands your Readiness File to a MASA advocate (with consent) so you don\'t repeat anything.'); }} />
        </div>
      </div>

      <div className="footdisc">
        SAM offers guidance, not medical advice. Readiness guidance is cited to Ready.gov (FEMA); emergency-cost
        figures: {MASA_STATS.citation} In an emergency, call 911.
      </div>
    </>
  );
}

function Chip({ id, done, icon, label, onClick }: { id: string; done: Set<string>; icon: string; label: string; onClick: () => void }) {
  return (
    <button className={`chip-btn ${done.has(id) ? 'done' : ''}`} onClick={onClick}>
      <span className="ci">{icon}</span>
      {label}
      {done.has(id) ? ' ✓' : ''}
    </button>
  );
}

function StepCard({ step, index, onCoverage }: { step: RankedStep; index: number; onCoverage: () => void }) {
  const ev = getEvidence(step.evidenceId);
  const isCoverage = step.seam === 'coverage';
  return (
    <div className={`step ${isCoverage ? 'optional' : ''}`}>
      <div className="num">STEP {index + 1}{isCoverage ? ' · optional' : ''}</div>
      <div className="st">{step.title}</div>
      <div className="sd">{step.desc}</div>
      {isCoverage ? (
        <span className="steplink" onClick={onCoverage}>
          See the questions to ask →
        </span>
      ) : (
        ev && (
          <a className="evidence" href={ev.sourceUrl} target="_blank" rel="noreferrer" title={ev.attribution}>
            {ev.publisher}: {ev.title}
          </a>
        )
      )}
    </div>
  );
}

function ArtifactCard({
  profile,
  onDownloadFile,
  onPrintCard,
  onAddDetails,
}: {
  profile: Profile;
  onDownloadFile: () => void;
  onPrintCard: () => void;
  onAddDetails: () => void;
}) {
  const t2 = profile.tier2;
  const row = (label: string, value: string | null) => (
    <div className="field">
      <span className="fl">{label}</span>
      <span className={`fv ${value ? '' : 'empty'}`}>{value || '— add this —'}</span>
    </div>
  );
  return (
    <>
      <div className="artifact">
        <div className="ahead">
          <Mark />
          <span className="at">Living Readiness File</span>
        </div>
        <div className="abody">
          {row('Name / label', t2.householdLabel)}
          {row('Medications', t2.medications)}
          {row('Allergies / conditions', t2.allergiesConditions)}
          {row('Emergency contact', t2.emergencyContact)}
        </div>
      </div>
      <div className="artifact-actions">
        <button className="btn btn-primary" onClick={onDownloadFile}>
          Download PDF
        </button>
        <button className="btn btn-ghost" onClick={onPrintCard}>
          Print wallet card
        </button>
        <button className="btn btn-ghost" onClick={onAddDetails}>
          Add details
        </button>
      </div>
    </>
  );
}

function CoverageModule({ profile, track }: { profile: Profile; track: (t: string, d?: Record<string, unknown>) => void }) {
  const copy = coverageCopy(profile.tier1.memberStatus);
  const [offerOpen, setOfferOpen] = useState(false);
  return (
    <div className="alert" style={{ marginTop: 8 }}>
      <div className="ah">{copy.heading}</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: '#444', marginBottom: 6 }}>{copy.intro}</p>
      <ul>
        {COVERAGE_QUESTIONS.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <div className="costgrid">
        <div className="cc">
          <div className="cn">{MASA_STATS.groundAmbulance}</div>
          <div className="cl">Avg. ground ambulance</div>
        </div>
        <div className="cc">
          <div className="cn">{MASA_STATS.airAmbulance}</div>
          <div className="cl">Avg. air ambulance</div>
        </div>
        <div className="cc">
          <div className="cn">{MASA_STATS.oopProbability}</div>
          <div className="cl">Chance of an out-of-pocket bill</div>
        </div>
      </div>
      <div className="src">Source: {MASA_STATS.citation}</div>

      {/* Prospect: offer appears only after engaging the questions (PRD §9.1). Member: reference only. */}
      {copy.offer && !offerOpen && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => { setOfferOpen(true); track('coverage_offer_shown'); }}>
          {copy.offer}
        </button>
      )}
      {copy.offer && offerOpen && (
        <div className="ctaband">
          <h3>{copy.offerCta}</h3>
          <p>MASA covers approved emergency ground and air transport — one predictable membership, no network limits.</p>
          <button className="btn btn-primary btn-block" onClick={() => { track('coverage_cta_click'); alert('Prototype: routes to coverage check / plan comparison / seminar registration.'); }}>
            Check my coverage options →
          </button>
        </div>
      )}
    </div>
  );
}
