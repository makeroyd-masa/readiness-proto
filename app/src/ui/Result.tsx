import { useState } from 'react';
import type { Profile } from '../domain/profile';
import { scoreProfile } from '../domain/scoring';
import { nextSteps, type RankedStep } from '../domain/steps';
import { getEvidence } from '../content/evidence';
import { coverageCopy, COVERAGE_QUESTIONS, MASA_STATS } from '../content/coverage';
import { Mark, SamBubble, Scorecard } from './common';
import { printFullFile, printWalletCard } from './print';
import { GoBagTool, HouseholdPlanTool, LtcGuideTool, PeopleRolesTool } from './Tools';
import { setCodeStatus } from '../store/codeStore';

type ToolKey = 'people' | 'gobag' | 'plan' | 'ltc';

/** Which action a next-step card opens; null = no in-app tool (evidence link only). */
const STEP_TOOL: Record<string, ToolKey | 'details'> = {
  emergency_card: 'details',
  contact_tree: 'people',
  decision_maker: 'people',
  legal_paperwork: 'people',
  go_bag: 'gobag',
  med_supply: 'gobag',
  written_plan: 'plan',
  ltc_conversation: 'ltc',
};

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
  const [financialOpen, setFinancialOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [openTool, setOpenTool] = useState<ToolKey | null>(null);
  const [appPrompted, setAppPrompted] = useState(false);
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

  function openSeam(seam: 'coverage' | 'financial') {
    if (seam === 'financial') {
      setFinancialOpen(true);
      track('financial_module_viewed');
    } else {
      openCoverage();
    }
  }

  function stepActionFor(id: string): (() => void) | undefined {
    const t = STEP_TOOL[id];
    if (!t) return undefined;
    if (t === 'details') return () => setConsentOpen(true);
    return () => setOpenTool(t);
  }

  function downloadApp() {
    setAppPrompted(true);
    if (profile.activeCode) setCodeStatus(profile.activeCode, 'completed');
    track('app_download_cta', { code: profile.activeCode });
    alert('Prototype: sends a link to download the AccessNow app. Your code carries this file into the app, so nothing is re-entered.');
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
        Here's your household resilience plan. {BAND_OPENER[score.band]}
      </SamBubble>

      {/* Scorecard — band first, % secondary (PRD §8.2) */}
      <Scorecard score={score} />

      {/* Dimensions — coverage is deliberately NOT here (PRD §8) */}
      <div className="section-h">Your resilience, area by area</div>
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
        <StepCard key={s.id} step={s} index={i} onSeam={openSeam} onAction={stepActionFor(s.id)} />
      ))}

      {/* Take action now — the three actionable tools (docs/Updated experience.txt) */}
      <div className="section-h">Take action now</div>
      <div className="toolcards">
        <button className="toolcard" onClick={() => setOpenTool('people')}>
          <span className="tcicon">🪪</span>
          <span className="tctitle">People &amp; roles</span>
          <span className="tcdesc">Add emergency contacts and name who can make medical decisions.</span>
        </button>
        <button className="toolcard" onClick={() => setOpenTool('gobag')}>
          <span className="tcicon">🎒</span>
          <span className="tctitle">Go-bag + med supply</span>
          <span className="tcdesc">Check off what's ready to grab in an emergency.</span>
        </button>
        <button className="toolcard" onClick={() => setOpenTool('ltc')}>
          <span className="tcicon">🗣️</span>
          <span className="tctitle">Long-term-care talk</span>
          <span className="tcdesc">A simple guide to start the conversation and write down what you decide.</span>
        </button>
        <button className="toolcard" onClick={() => setOpenTool('plan')}>
          <span className="tcicon">📋</span>
          <span className="tctitle">Holistic plan</span>
          <span className="tcdesc">Assemble everything into one printable household plan.</span>
        </button>
      </div>
      {openTool === 'people' && <PeopleRolesTool profile={profile} commit={commit} track={track} onClose={() => setOpenTool(null)} />}
      {openTool === 'gobag' && <GoBagTool profile={profile} commit={commit} track={track} onClose={() => setOpenTool(null)} />}
      {openTool === 'ltc' && <LtcGuideTool profile={profile} commit={commit} track={track} onClose={() => setOpenTool(null)} />}
      {openTool === 'plan' && <HouseholdPlanTool profile={profile} commit={commit} track={track} onClose={() => setOpenTool(null)} />}
      {financialOpen && <FinancialModule profile={profile} track={track} />}

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

      {/* Download-app CTA — simulated; carries this file into the app via the code. */}
      <div className="appcta">
        <div className="appcta-txt">
          <div className="appcta-h">Save your results — get the app</div>
          <div className="appcta-d">Download AccessNow to keep this file on your phone, update it any time, and share it with your household.</div>
        </div>
        <button className="btn btn-primary" onClick={downloadApp}>{appPrompted ? '✓ Check your phone' : 'Download the app'}</button>
      </div>

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

function StepCard({ step, index, onSeam, onAction }: { step: RankedStep; index: number; onSeam: (s: 'coverage' | 'financial') => void; onAction?: () => void }) {
  const ev = getEvidence(step.evidenceId);
  const isModule = step.seam === 'coverage' || step.seam === 'financial';
  return (
    <div className={`step ${isModule ? 'optional' : ''}`}>
      <div className="num">STEP {index + 1}{isModule ? ' · optional' : ''}</div>
      <div className="st">{step.title}</div>
      <div className="sd">{step.desc}</div>
      <div className="steprow">
        {isModule ? (
          <span className="steplink" onClick={() => onSeam(step.seam as 'coverage' | 'financial')}>
            See the questions to ask →
          </span>
        ) : (
          <>
            {onAction && (
              <button className="btn btn-primary btn-sm" onClick={onAction}>
                Do it now →
              </button>
            )}
            {ev && (
              <a className="evidence" href={ev.sourceUrl} target="_blank" rel="noreferrer" title={ev.attribution}>
                {ev.publisher}: {ev.title}
              </a>
            )}
          </>
        )}
      </div>
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
  const contactsSummary = t2.contacts.length
    ? t2.contacts.map((c) => `${c.name}${c.phone ? ` · ${c.phone}` : ''}`).join('; ')
    : t2.emergencyContact;
  const t1 = profile.tier1;
  const AUTH: Record<string, string> = { documented: 'Proxy + HIPAA signed', partial: 'Started', none: 'Not yet' };
  const RUNWAY: Record<string, string> = { ample: '6+ months', some: '1–3 months', little: 'Under a month', unsure: 'Not sure' };
  const LTC: Record<string, string> = { documented: 'Discussed & written down', informal: 'Discussed', none: 'Not yet' };
  return (
    <>
      <div className="artifact">
        <div className="ahead">
          <Mark />
          <span className="at">Living Resilience File</span>
        </div>
        <div className="abody">
          {row('Name / label', t2.householdLabel)}
          {row('Medications', t2.medications)}
          {row('Allergies / conditions', t2.allergiesConditions)}
          {row('Emergency contacts', contactsSummary)}
          {row('Decision-maker', t2.decisionMakerName)}
          {row('Legal authority', t1.decisionAuthority ? AUTH[t1.decisionAuthority] : null)}
          {row('Financial cushion', t1.financialRunway ? RUNWAY[t1.financialRunway] : null)}
          {(t1.agingParent === 'yes' || t1.householdType === 'multigen') && row('Long-term care', t1.ltcConversation ? LTC[t1.ltcConversation] : null)}
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

/**
 * Financial-cushion education module (v3, HR-V3-07 / §6.3). Education-first: it explains
 * runway and low-cost ways to extend it. Any product connection appears ONLY here, after
 * the free artifact exists and the user chose to open this — never as a scored gap or a
 * step title.
 */
function FinancialModule({ profile, track }: { profile: Profile; track: (t: string, d?: Record<string, unknown>) => void }) {
  const [offerOpen, setOfferOpen] = useState(false);
  const runway = profile.tier1.financialRunway;
  const readout: Record<string, string> = {
    ample: 'You told us six months or more — a strong cushion. Keep it topped up.',
    some: 'You told us one to three months — a real start, worth extending.',
    little: 'You told us less than a month — the highest-impact area to shore up.',
    unsure: "You weren't sure — knowing the number is the first step.",
  };
  return (
    <div className="alert" style={{ marginTop: 8 }}>
      <div className="ah">Your household's financial cushion</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: '#444', marginBottom: 6 }}>
        {runway ? readout[runway] : 'A cushion is how long your household could keep up with bills if a health event kept an earner out of work.'}
      </p>
      <ul>
        <li>Estimate three months of essential bills — housing, food, utilities, minimum payments.</li>
        <li>Note what's already set aside, and where a gap would open.</li>
        <li>Decide one small, automatic step to extend the runway this quarter.</li>
      </ul>
      {!offerOpen ? (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => { setOfferOpen(true); track('financial_offer_shown'); }}>
          See how a MASA advocate can help
        </button>
      ) : (
        <div className="ctaband">
          <h3>Talk it through with an advocate</h3>
          <p>An advocate can walk through your cushion with you and, only if it fits, the options that protect income during a health event.</p>
          <button className="btn btn-primary btn-block" onClick={() => { track('financial_cta_click'); alert('Prototype: routes to a MASA advocate / inside-sales conversation, with your plan as context.'); }}>
            Connect me with an advocate →
          </button>
        </div>
      )}
    </div>
  );
}
